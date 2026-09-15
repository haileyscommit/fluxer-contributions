// SPDX-License-Identifier: AGPL-3.0-or-later

import { Persona } from '@app/features/personas/models/Persona';
//import type {UserPrivate, User as WireUser} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {PersonaResponse as WireOtherPersona, OwnPersonaResponse as WireOwnPersona} from "@fluxer/schema/src/domains/persona/PersonaSchemas";
import {action, makeAutoObservable, reaction, runInAction} from 'mobx';
import Users from './Users';

type WirePersona = WireOtherPersona | WireOwnPersona;

// const CURRENT_PERSONA_PRIVATE_WIRE_KEYS = [
// 	'internal_name',
// ] as const;

// function isPublicOnlyCurrentUserPayload(user: WireUser): boolean {
// 	if (typeof user.mention_flags === 'number') {
// 		return false;
// 	}
// 	return !CURRENT_USER_PRIVATE_WIRE_KEYS.some((key) => key in user);
// }

class Personas {
	personas: Record<string, Persona> = {};
	globalActivePersonaId: string = "";
	guildActivePersonaIds: Record<string, string> = {};
	dmActivePersonaIds: Record<string, string> = {};
	ownPersonas: Set<string> = new Set();
	personaCount = 0;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	getGlobalActivePersonaId(): Persona | null {
		if (!this.globalActivePersonaId) return null;
		if (!this.ownPersonas.has(this.globalActivePersonaId)) return null;
		return this.personas[this.globalActivePersonaId] || null;
	}
	setGlobalActivePersona(personaId: string) {
		if (!personaId) {
			this.globalActivePersonaId = "";
			return;
		}
		console.log("ERDSFsdfds", personaId);
		if (!this.ownPersonas.has(personaId)) return;
		this.globalActivePersonaId = personaId;
		this.personaCount++;
	}
	getGuildActivePersonaId(guildId: string): Persona | null {
		if (!guildId) return null;
		if (!this.guildActivePersonaIds[guildId]) return null;
		if (!this.ownPersonas.has(guildId)) return null;
		return this.personas[this.guildActivePersonaIds[guildId]] || null;
	}
	setGuildActivePersona(guildId: string, personaId: string) {
		if (!guildId) {
			delete this.guildActivePersonaIds[guildId];
			return;
		}
		if (!this.ownPersonas.has(this.guildActivePersonaIds[guildId])) return;
		this.guildActivePersonaIds[guildId] = personaId;
		this.personaCount++;
	}
	getDmActivePersonaId(channelId: string): Persona | null {
		if (!channelId) return null;
		if (!this.dmActivePersonaIds[channelId]) return null;
		if (!this.ownPersonas.has(channelId)) return null;
		return this.personas[this.dmActivePersonaIds[channelId]] || null;
	}
	setDmActivePersona(channelId: string, personaId: string) {
		if (!channelId) {
			delete this.dmActivePersonaIds[channelId];
			return;
		}
		if (!this.ownPersonas.has(this.dmActivePersonaIds[channelId])) return;
		this.dmActivePersonaIds[channelId] = personaId;
		this.personaCount++;
	}

	getOwnPersonas(): ReadonlyArray<Persona> {
		const userId = Users.currentUserId;
		if (!userId) return [];
		const personas = Object.values(this.personas).filter((p) => p.userId === userId);
		this.ownPersonas = new Set(personas.map((v) => v.id));
		return personas;
	}

	get allPersonasList(): ReadonlyArray<Persona> {
		return Object.values(this.personas);
	}

	getPersona(personaId: string): Persona | undefined {
		return this.personas[personaId];
	}

	// this'll mean something different later
	// getCurrentPersona(): Persona | undefined {
	// 	return this.currentPersona ?? undefined;
	// }

	// getPersonaByTag(tag: string): Persona | undefined {
	// 	return this.allPersonasList.find((persona) => persona. === tag);
	// }

	getAllPersonas(): ReadonlyArray<Persona> {
		return this.allPersonasList;
	}

	// @action
	// handleGatewayReady(currentPersona: PersonaPrivate): void {
	// 	const personaRecord = new User(currentUser);
	// 	this.personas = {
	// 		[currentUser.id]: personaRecord,
	// 	};
	// 	this.personaCount = 1;
	// 	if (!personaRecord.isClaimed()) {
	// 		setTimeout(async () => {
	// 			const {openClaimAccountModal} = await import('@app/features/auth/components/modals/ClaimAccountModal');
	// 			openClaimAccountModal();
	// 		}, 1000);
	// 	}
	// }

	@action
	handlePersonaUpdate(
		persona: WirePersona,
		options?: {
			clearMissingOptionalFields?: boolean;
		},
	): void {
		const existingPersona = this.personas[persona.id];
		// if (
		// 	persona.id === this.currentPersonaId &&
		// 	existingPersona &&
		// 	options?.clearMissingOptionalFields !== true //&&
		// 	//isPublicOnlyCurrentUserPayload(user)
		// ) {
		// 	return;
		// }
		this.storePersona(existingPersona, existingPersona ? existingPersona.withUpdates(persona /*, options*/) : new Persona(persona));
	}

	private storePersona(existingPersona: Persona | undefined, nextPersona: Persona): void {
		if (existingPersona) {
			if (existingPersona.equals(nextPersona)) {
				return;
			}
		} else {
			this.personaCount += 1;
		}
		this.personas[nextPersona.id] = nextPersona;
	}

	cachePersonas(
		personas: Array<WirePersona>,
	): void {
		runInAction(() => {
			for (const persona of personas) {
				const existingPersona = this.personas[persona.id];
				// if (persona.id === this.currentPersonaId && existingPersona /* && isPublicOnlyCurrentPersonaPayload(persona) */) {
				// 	continue;
				// }
				this.storePersona(existingPersona, existingPersona ? existingPersona.withUpdates(persona) : new Persona(persona));
			}
		});
	}

	removePersona(personaId: string) {
		delete this.personas[personaId];
		this.personaCount += 1;
	}

	subscribe(callback: () => void): () => void {
		return reaction(
			() => this.personaCount,
			() => callback(),
			{fireImmediately: true},
		);
	}
}

export default new Personas();
