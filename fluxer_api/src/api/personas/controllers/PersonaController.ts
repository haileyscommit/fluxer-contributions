import { createPersonaID, createUserID } from "@app/api/BrandedTypes";
import { LoginRequired } from "@app/api/middleware/AuthMiddleware";
import { RateLimitMiddleware } from "@app/api/middleware/RateLimitMiddleware";
import { OpenAPI } from "@app/api/middleware/ResponseTypeMiddleware";
import { RateLimitConfigs } from "@app/api/RateLimitConfig";
import type { HonoApp } from "@app/api/types/HonoEnv";
import { Validator } from "@app/api/Validator";
import { RelationshipTypes } from "@fluxer/constants/src/UserConstants.js";
import { PersonaIdParam, UserPersonaIdParam } from "@fluxer/schema/src/domains/common/CommonParamSchemas.js";
import { PersonaCreateRequest, PersonaPatchRequest, PersonaResponse } from "@fluxer/schema/src/domains/persona/PersonaSchemas.js";
import { z } from "zod";

export function PersonaController(app: HonoApp) {
	app.get(
		'/users/@me/personas',
		RateLimitMiddleware(RateLimitConfigs.USER_GET),
		LoginRequired,
		//Validator('param', PersonaIdParam),
		//Validator('query', GuildMemberListQuery), // TODO: query list
		OpenAPI({
			operationId: 'list_own_personas',
			summary: 'List own personas',
			responseSchema: z.array(PersonaResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Personas'],
			description:
				// Took out 'Supports pagination with limit and after cursor.' after the first sentence cause it doesn't do that yet
				'List personas for the current user. Returns a list of all personas that belong to the signed-in user.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			//const requestCache = ctx.get('requestCache');
			const personaService = ctx.get('personaService');
			return ctx.json(await personaService.getUserPersonas(userId));
			//return ctx.json([]);
		}
	);

	app.get(
		'/users/:user_id/personas/:persona_id',
		RateLimitMiddleware(RateLimitConfigs.USER_GET),
		LoginRequired,
		Validator('param', UserPersonaIdParam),
		//Validator('query', GuildMemberListQuery), // TODO: query list
		OpenAPI({
			operationId: 'get_persona',
			summary: 'Get the profile for a persona.',
			responseSchema: z.array(PersonaResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Personas'],
			description:
				// Took out 'Supports pagination with limit and after cursor.' after the first sentence cause it doesn't do that yet
				'Retrieves the profile of a persona by its ID.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const {user_id, persona_id} = ctx.req.valid('param');
			//const requestCache = ctx.get('requestCache');
			// TODO: if the
			const userService = ctx.get('userService');
			if (userId.toString() !== user_id.toString() && user_id !== "@me") {
				// pretend that the persona doesn't exist to people who the persona owner has blocked
				const relationship = await userService.relationshipService.getRelationship({userId, targetId: createUserID(user_id), type: RelationshipTypes.BLOCKED});
				if (relationship) return ctx.notFound();
			}
			const personaService = ctx.get('personaService');
			const uid = user_id === "@me" ? userId : user_id;
			const response = await personaService.getPersona(createUserID(uid), createPersonaID(persona_id));
			if (!response) return ctx.notFound();
			console.log(response);
			return ctx.json(response);
		}
	);

	app.post(
		'/users/@me/personas',
		RateLimitMiddleware(RateLimitConfigs.USER_UPDATE_SELF),
		LoginRequired,
		//Validator('param', PersonaIdParam),
		//Validator('query', GuildMemberListQuery), // TODO: query list
		Validator('json', PersonaCreateRequest),
		OpenAPI({
			operationId: 'create_persona',
			summary: 'Create a new persona',
			responseSchema: PersonaResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Personas'],
			description:
				'Creates a new persona with the specified properties. Returns a list of all personas that belong to the signed-in user.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const data = ctx.req.valid('json');
			const personaService = ctx.get('personaService');
			const persona = await personaService.createPersona(user, data);
			return ctx.json(await personaService.getPersona(user.id, persona));
		}
	);

	app.patch(
		'/users/@me/personas/:persona_id',
		RateLimitMiddleware(RateLimitConfigs.USER_UPDATE_SELF),
		LoginRequired,
		Validator('param', PersonaIdParam),
		Validator('json', PersonaPatchRequest),
		OpenAPI({
			operationId: 'update_persona',
			summary: 'Update a persona.',
			requestSchema: PersonaPatchRequest,
			responseSchema: PersonaResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Personas'],
			description:
				'Updates a persona by its ID. Included fields will be patched onto the existing data.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const {persona_id} = ctx.req.valid('param');
			const data = ctx.req.valid('json');
			//const requestCache = ctx.get('requestCache');
			const personaService = ctx.get('personaService');
			const personaId = createPersonaID(persona_id);
			const response = await personaService.checkPersonaExists(userId, personaId);
			if (!response) return ctx.notFound();
			console.log(data);
			await personaService.updatePersona(userId, personaId, data);
			const finalResponse = await personaService.getPersona(userId, personaId);
			return ctx.json(finalResponse);
		}
	);

	app.delete(
		'/users/@me/personas/:persona_id',
		RateLimitMiddleware(RateLimitConfigs.USER_UPDATE_SELF),
		LoginRequired,
		Validator('param', PersonaIdParam),
		OpenAPI({
			operationId: 'delete_persona',
			summary: 'Delete a persona',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Personas'],
			description:
				'Deletes the persona by its ID.',
		}),
		async (ctx) => {
			const {persona_id} = ctx.req.valid('param');
			const user = ctx.get('user');
			const personaService = ctx.get('personaService');
			// const persona = await personaService.createPersona(user, data);
			// return ctx.json(await personaService.getPersona(user.id, persona));
			const persona = createPersonaID(persona_id);
			await personaService.deletePersona(user.id, persona);
			const check = await personaService.getPersona(user.id, persona);
			if (check) throw new Error("Persona deletion failed");
			return ctx.body(null, 204);
		}
	);
}
