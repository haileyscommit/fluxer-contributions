import type { PersonaID, UserID } from "../BrandedTypes";
import type { PersonaTriggerRow } from "../database/types/PersonaTypes";
import { PersonaTriggers } from "../Tables";

export class PersonaTrigger {
	constructor(
		readonly prefix: string | null,
		readonly suffix: string | null,
	) {}

	toRow(userId: UserID, personaId: PersonaID): PersonaTriggerRow {
		return {
			owner_id: userId,
			persona_id: personaId,
			prefix: this.prefix,
			suffix: this.suffix
		};
	}
}
