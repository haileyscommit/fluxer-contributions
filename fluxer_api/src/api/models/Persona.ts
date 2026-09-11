import type { PersonaGroupID, PersonaID, UserID } from "../BrandedTypes";
import type { PersonaRow } from "../database/types/PersonaTypes";

export class Persona {
	readonly id: PersonaID;
	/** The ID of the account that can edit and use this persona. */
	readonly owner: UserID;
	readonly globalName: string;
	readonly group: PersonaGroupID | null;
	readonly avatarHash: string | null;
	readonly avatarColor: number | null;
	readonly bannerHash: string | null;
	readonly bannerColor: number | null;
	readonly bio: string | null;
	readonly pronouns: string | null;
	readonly accentColor: number | null;
	/** Used for sorting by recency */
	readonly lastUsedAt: Date | null;

	constructor(row: PersonaRow) {
		this.id = row.persona_id;
		this.owner = row.owner_id;
		this.globalName = row.global_name;
		this.group = row.group;
		this.avatarHash = row.avatar_hash;
		this.avatarColor = row.avatar_color;
		this.bannerHash = row.banner_hash;
		this.bannerColor = row.banner_color;
		this.bio = row.bio;
		this.pronouns = row.pronouns;
		this.accentColor = row.accent_color;
		this.lastUsedAt = row.last_used_at;
	}

	toRow(): PersonaRow {
		return {
			persona_id: this.id,
			owner_id: this.owner,
			global_name: this.globalName,
			group: this.group,
			avatar_hash: this.avatarHash,
			avatar_color: this.avatarColor,
			banner_hash: this.bannerHash,
			banner_color: this.bannerColor,
			bio: this.bio,
			pronouns: this.pronouns,
			accent_color: this.accentColor,
			last_used_at: this.lastUsedAt
		};
	}
}
