// SPDX-License-Identifier: AGPL-3.0-or-later

import type {PersonaResponse} from '@fluxer/schema/src/domains/persona/PersonaSchemas';
import type {INatsConnectionManager} from '@pkgs/nats/src/INatsConnectionManager';
import {NatsConnectionManager} from '@pkgs/nats/src/NatsConnectionManager';
import {StringCodec} from 'nats';
import {createPersonaID, createUserID, type PersonaID} from '../BrandedTypes';
import {Config} from '../Config';
import {Logger} from '../Logger';
import {isJsonRecord, parseJsonRecord, parseJsonWithGuard} from '../utils/JsonBoundaryUtils';
import {throwForSvcErrorReply} from './SvcErrorReply';

const USERS_SERVICE_SUBJECT = process.env.FLUXER_PERSONAS_SERVICE_SUBJECT || 'svc.personas';
const DEFAULT_USERS_SERVICE_TIMEOUT_MS = 6000;
const DEFAULT_USERS_SERVICE_INFLIGHT_MAX_ENTRIES = 10000;

export interface IPersonasServiceClient {
	getPersonaResponses(userIds: Array<PersonaID>): Promise<Map<PersonaID, PersonaResponse>>;
	invalidateUserCache(userId: PersonaID): Promise<void>;
}

type PersonaServiceResponse =
	| {
			FoundApiPartials: Array<PersonaResponse>;
	  }
	| {
			FoundApiPartial: PersonaResponse;
	  }
	| 'NotFound'
	| 'Invalidated';

function isPersonaResponse(value: unknown): value is PersonaResponse {
	return isJsonRecord(value) && typeof value.id === 'string';
}

function isPersonasServiceResponse(value: unknown): value is PersonaServiceResponse {
	if (value === 'NotFound' || value === 'Invalidated') return true;
	if (!isJsonRecord(value)) return false;
	if ('FoundApiPartials' in value) {
		return Array.isArray(value.FoundApiPartials) && value.FoundApiPartials.every(isPersonaResponse);
	}
	if ('FoundApiPartial' in value) {
		return isPersonaResponse(value.FoundApiPartial);
	}
	return false;
}

export class NatsPersonasServiceClient implements IPersonasServiceClient {
	private readonly codec = StringCodec();
	private readonly inflightPartials = new Map<string, Promise<PersonaResponse | undefined>>();

	constructor(
		private readonly connectionManager: INatsConnectionManager,
		private readonly requestTimeoutMs = DEFAULT_USERS_SERVICE_TIMEOUT_MS,
		private readonly subject = USERS_SERVICE_SUBJECT,
		private readonly maxInflightEntries = DEFAULT_USERS_SERVICE_INFLIGHT_MAX_ENTRIES,
	) {}

	async getPersonaResponses(userIds: Array<PersonaID>): Promise<Map<PersonaID, PersonaResponse>> {
		const uniqueUserIds = uniqueSortedUserIds(userIds);
		if (uniqueUserIds.length === 0) {
			return new Map();
		}
		const result = new Map<PersonaID, PersonaResponse>();
		const existing: Array<Promise<void>> = [];
		const misses: Array<PersonaID> = [];
		for (const userId of uniqueUserIds) {
			const key = userId.toString();
			const inflight = this.inflightPartials.get(key);
			if (inflight) {
				existing.push(this.copyInflightPartial(userId, inflight, result));
				continue;
			}
			misses.push(userId);
		}
		const newlyFetched = this.fetchAndCoalesceMissingPartials(misses, result);
		await Promise.all([...existing, newlyFetched]);
		return result;
	}

	private async fetchPersonaResponses(userIds: Array<PersonaID>): Promise<Map<PersonaID, PersonaResponse>> {
		const response = await this.request({
			op: 'GetApiPartialsByIds',
			user_ids: userIds.map((userId) => userId.toString()),
		});
		const partials =
			typeof response === 'object' && 'FoundApiPartials' in response
				? response.FoundApiPartials
				: typeof response === 'object' && 'FoundApiPartial' in response
					? [response.FoundApiPartial]
					: [];
		const result = new Map<PersonaID, PersonaResponse>();
		for (const partial of partials) {
			try {
				const personaId = createPersonaID(BigInt(partial.id));
				result.set(personaId, partial);
			} catch (error) {
				Logger.warn({personaId: partial.id, error}, '[personas-service] invalid persona id');
			}
		}
		return result;
	}

	private async fetchAndCoalesceMissingPartials(
		userIds: Array<PersonaID>,
		result: Map<PersonaID, PersonaResponse>,
	): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const capacity = Math.max(0, this.maxInflightEntries - this.inflightPartials.size);
		const coalesced = userIds.slice(0, capacity);
		const direct = userIds.slice(capacity);
		const tasks: Array<Promise<void>> = [];
		if (coalesced.length > 0) {
			const batch = this.fetchPersonaResponses(coalesced);
			for (const userId of coalesced) {
				const key = userId.toString();
				const partial = batch
					.then((partials) => partials.get(userId))
					.finally(() => {
						this.inflightPartials.delete(key);
					});
				this.inflightPartials.set(key, partial);
				tasks.push(this.copyInflightPartial(userId, partial, result));
			}
		}
		if (direct.length > 0) {
			tasks.push(
				this.fetchPersonaResponses(direct).then((partials) => {
					for (const [userId, partial] of partials) {
						result.set(userId, partial);
					}
				}),
			);
		}
		await Promise.all(tasks);
	}

	private async copyInflightPartial(
		userId: PersonaID,
		partialPromise: Promise<PersonaResponse | undefined>,
		result: Map<PersonaID, PersonaResponse>,
	): Promise<void> {
		const partial = await partialPromise;
		if (partial) {
			result.set(userId, partial);
		}
	}

	async invalidateUserCache(userId: PersonaID): Promise<void> {
		await this.request({
			op: 'Invalidate',
			user_id: userId.toString(),
		});
	}

	private async request(payload: Record<string, unknown>): Promise<PersonaServiceResponse> {
		try {
			if (this.connectionManager.isClosed()) {
				await this.connectionManager.connect();
			}
			const connection = this.connectionManager.getConnection();
			const response = await connection.request(this.subject, this.codec.encode(JSON.stringify(payload)), {
				timeout: this.requestTimeoutMs,
			});
			const decoded = this.codec.decode(response.data);
			const parsed = parseJsonWithGuard(decoded, isPersonasServiceResponse);
			if (!parsed) {
				throwForSvcErrorReply('personas-service', parseJsonRecord(decoded));
				throw new Error('[personas-service] invalid response payload');
			}
			return parsed;
		} catch (error) {
			Logger.warn({error, op: payload.op}, '[personas-service] request failed');
			throw error;
		}
	}
}

let usersServiceClient: IPersonasServiceClient | undefined;
let injectedPersonasServiceClient: IPersonasServiceClient | undefined;

export function setInjectedPersonasServiceClient(client: IPersonasServiceClient | undefined): void {
	injectedPersonasServiceClient = client;
	usersServiceClient = undefined;
}

export function createPersonasServiceClient(): IPersonasServiceClient {
	if (injectedPersonasServiceClient !== undefined) {
		return injectedPersonasServiceClient;
	}
	if (usersServiceClient !== undefined) {
		return usersServiceClient;
	}
	const manager = new NatsConnectionManager({
		url: Config.nats.coreUrl,
		token: Config.nats.authToken || undefined,
		name: process.env.FLUXER_USERS_SERVICE_NATS_CLIENT_NAME || 'fluxer-api-users',
	});
	void manager.connect().catch((error) => {
		Logger.warn({error}, '[personas-service] Failed to establish NATS connection');
	});
	usersServiceClient = new NatsPersonasServiceClient(
		manager,
		readPositiveIntegerEnv('FLUXER_USERS_SERVICE_TIMEOUT_MS'),
		USERS_SERVICE_SUBJECT,
		readPositiveIntegerEnv('FLUXER_USERS_SERVICE_INFLIGHT_MAX_ENTRIES', DEFAULT_USERS_SERVICE_INFLIGHT_MAX_ENTRIES),
	);
	return usersServiceClient;
}

function readPositiveIntegerEnv(name: string, fallback = DEFAULT_USERS_SERVICE_TIMEOUT_MS): number {
	const value = process.env[name];
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function uniqueSortedUserIds(userIds: Array<PersonaID>): Array<PersonaID> {
	const seen = new Map<string, PersonaID>();
	for (const userId of userIds) {
		seen.set(userId.toString(), userId);
	}
	return Array.from(seen.entries())
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
		.map(([, userId]) => userId);
}
