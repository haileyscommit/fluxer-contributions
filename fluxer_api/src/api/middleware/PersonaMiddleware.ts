import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../types/HonoEnv";
import { PersonaService } from "../personas/services/PersonaService";
import { PersonaRepository } from "../personas/repositories/PersonaRepository";
import { AttachmentUploadTraceRepository } from "../channel/repositories/message/AttachmentUploadTraceRepository";
import { VirusScanService } from "../infrastructure/VirusScanService";

export const PersonaMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	ctx.set("personaService", new PersonaService(
		new PersonaRepository(),
		ctx.get("snowflakeService"),
		ctx.get("entityAssetService"),
		ctx.get("userCacheService"),
		ctx.get("requestCache"),
		ctx.get("storageService"),
		new AttachmentUploadTraceRepository(),
		ctx.get("mediaService"),
		new VirusScanService(ctx.get("cacheService"))
	));
	return next();
});
