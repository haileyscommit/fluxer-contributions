import { createPersonaID, type PersonaID, type UserID } from "@app/api/BrandedTypes";
import type { PersonaCreateRequest, PersonaResponse } from "@fluxer/schema/src/domains/persona/PersonaSchemas.js";
import type { PersonaRepository } from "../repositories/PersonaRepository";
import type { User } from "@app/api/models/User";
import { contentModerationService } from "@app/api/infrastructure/ContentModerationService";
import type { EntityAssetService, PreparedAssetUpload } from "@app/api/infrastructure/EntityAssetService";
import { AttachmentProcessingService } from "@app/api/channel/services/message/AttachmentProcessingService";
import type { AttachmentUploadTraceRepository } from "@app/api/channel/repositories/message/AttachmentUploadTraceRepository";
import type { VirusScanService } from "@app/api/infrastructure/VirusScanService";
import { AttachmentDecayService } from "@app/api/attachment/AttachmentDecayService";
import type { ISnowflakeService } from "@app/api/infrastructure/ISnowflakeService";
import type { IStorageService } from "@app/api/infrastructure/IStorageService";
import type { IMediaService } from "@app/api/infrastructure/IMediaService";
import { PersonaTrigger } from "@app/api/models/PersonaTrigger";

export class PersonaService {
	private readonly attachmentService: AttachmentProcessingService;
	private readonly attachmentDecayService: AttachmentDecayService;
	constructor(
		private readonly personaRepository: PersonaRepository,
		private readonly snowflakeService: ISnowflakeService,
		private readonly entityAssetService: EntityAssetService,
		storageService: IStorageService,
		attachmentUploadTraceRepository: AttachmentUploadTraceRepository,
		mediaService: IMediaService,
		virusScanService: VirusScanService,
	) {
		this.attachmentService = new AttachmentProcessingService(
			storageService,
			attachmentUploadTraceRepository,
			mediaService,
			virusScanService,
			snowflakeService,
		);
		this.attachmentDecayService = new AttachmentDecayService();
	}
	async getUserPersonas(userId: UserID): Promise<Array<PersonaResponse>> {
		const results = await this.personaRepository.listUserPersonas(userId);
		const personas = new Set<PersonaResponse>();
		for (const v of results) {
			const triggers = await this.personaRepository.getPersonaTriggers(userId, v.id)
			personas.add({
				id: v.id.toString(),
				user: {
					id: v.owner.toString(),
					username: "",
					avatar: null,
					avatar_color: null,
					discriminator: "0000",
					flags: 0,
					global_name: "",
				},
				avatar: v.avatarHash,
				avatar_color: v.avatarColor,
				banner: v.bannerHash,
				banner_color: v.bannerColor,
				global_name: v.globalName,
				bio: v.bio,
				pronouns: v.pronouns,
				accent_color: v.accentColor,
				triggers: triggers || [],
			});
		}
		return Array.from(personas);
	}

	async checkPersonaExists(userId: UserID, personaId: PersonaID): Promise<boolean> {
		const v = await this.personaRepository.getPersona(userId, personaId);
		return !!v;
	}

	async getPersona(userId: UserID, personaId: PersonaID): Promise<PersonaResponse | null> {
		const v = await this.personaRepository.getPersona(userId, personaId);
		if (v === null) return null;
		const triggers = await this.personaRepository.getPersonaTriggers(userId, v.id)
		return {
			id: v.id.toString(),
			user: {
				id: v.owner.toString(),
				username: "",
				avatar: null,
				avatar_color: null,
				discriminator: "0000",
				flags: 0,
				global_name: "",
			},
			avatar: v.avatarHash,
			avatar_color: v.avatarColor,
			banner: v.bannerHash,
			banner_color: v.bannerColor,
			global_name: v.globalName,
			bio: v.bio,
			pronouns: v.pronouns,
			accent_color: v.accentColor,
			triggers: triggers || [],
		};
	}

	async createPersona(user: User, data: PersonaCreateRequest): Promise<PersonaID> {
		// TODO: it looks like this is the right place to do data validation, screening, and snowflake generation
		const personaId = createPersonaID(await this.snowflakeService.generate());
		contentModerationService.scanText(data.global_name, {
			userId: user.id,
			guildId: null,
			channelId: null,
			messageId: null,
			surface: 'profile_field',
		});
		let preparedAvatar: PreparedAssetUpload | null = null;
		if (data.avatar) {
			// TODO: how to make this decay?
			preparedAvatar = await this.entityAssetService.prepareAssetUpload({
				assetType: 'avatar',
				entityType: 'persona',
				entityId: personaId,
				previousHash: null,
				base64Image: data.avatar,
				errorPath: 'avatar',
			});
		}
		let preparedBanner: PreparedAssetUpload | null = null;
		if (data.banner) {
			// TODO: how to make this decay?
			preparedBanner = await this.entityAssetService.prepareAssetUpload({
				assetType: 'banner',
				entityType: 'persona',
				entityId: personaId,
				previousHash: null,
				base64Image: data.banner,
				errorPath: 'banner',
			});
		}
		const avatarHash = preparedAvatar?.newHash ?? null;
		const bannerHash = preparedBanner?.newHash ?? null;
		// Write to database via repository
		await this.personaRepository.createPersona(user.id, {
			persona_id: personaId,
			owner_id: user.id,
			accent_color: data.accent_color || null,
			global_name: data.global_name,
			bio: data.bio || null,
			group: null,
			pronouns: data.pronouns || null,
			avatar_hash: avatarHash,
			banner_hash: bannerHash,
			avatar_color: null,
			banner_color: null,
			last_used_at: null
		});
		await this.personaRepository.setPersonaTriggers(user.id, personaId, data.triggers.map((v) => new PersonaTrigger(v.prefix || null, v.suffix || null)))
		return personaId;
	}

	async updatePersona(userId: UserID, personaId: PersonaID, data: Partial<PersonaCreateRequest>): Promise<PersonaResponse> {
		// TODO: it looks like this is the right place to do data validation, screening, and snowflake generation
		if (data.global_name) contentModerationService.scanText(data.global_name, {
			userId: userId,
			guildId: null,
			channelId: null,
			messageId: null,
			surface: 'profile_field',
		});
		let preparedAvatar: PreparedAssetUpload | null | undefined;
		if (data.avatar) {
			// TODO: how to make this decay?
			preparedAvatar = await this.entityAssetService.prepareAssetUpload({
				assetType: 'avatar',
				entityType: 'persona',
				entityId: personaId,
				previousHash: null,
				base64Image: data.avatar,
				errorPath: 'avatar',
			});
		}
		let preparedBanner: PreparedAssetUpload | null | undefined;
		if (data.banner) {
			// TODO: how to make this decay?
			preparedBanner = await this.entityAssetService.prepareAssetUpload({
				assetType: 'banner',
				entityType: 'persona',
				entityId: personaId,
				previousHash: null,
				base64Image: data.banner,
				errorPath: 'banner',
			});
		}
		const avatarHash = preparedAvatar?.newHash ?? null;
		const bannerHash = preparedBanner?.newHash ?? null;
		// Write to database via repository
		await this.personaRepository.updatePersona(userId, personaId, {
			accent_color: data.accent_color,
			global_name: data.global_name,
			bio: data.bio,
			pronouns: data.pronouns,
			avatar_hash: preparedAvatar === undefined ? undefined : avatarHash,
			banner_hash: preparedBanner === undefined ? undefined : bannerHash,
		});
		if (data.triggers) await this.personaRepository.setPersonaTriggers(userId, personaId, data.triggers.map((v) => new PersonaTrigger(v.prefix || null, v.suffix || null)));
		if (data.triggers === null) await this.personaRepository.setPersonaTriggers(userId, personaId, []);
		return (await this.getPersona(userId, personaId))!;
	}

	async deletePersona(userId: UserID, personaId: PersonaID): Promise<void> {
		await this.personaRepository.deletePersona(userId, personaId);
	}
}
