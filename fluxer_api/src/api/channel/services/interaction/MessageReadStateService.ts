// SPDX-License-Identifier: AGPL-3.0-or-later

import {dispatchChannelEvent} from '@app/api/channel/services/ChannelGatewayDispatch';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import type {PersonaID, UserID} from '../../../BrandedTypes';
import type {Channel} from '../../../models/Channel';
import type {AuthenticatedChannel} from '../AuthenticatedChannel';
import {MessageInteractionBase} from './MessageInteractionBase';

export class MessageReadStateService extends MessageInteractionBase {
	async startTyping({authChannel, userId, personaId}: {authChannel: AuthenticatedChannel; userId: UserID; personaId?: PersonaID}): Promise<void> {
		const {channel, guild} = authChannel;
		this.ensureTextChannel(channel);
		if (this.isOperationDisabled(guild, GuildOperations.TYPING_EVENTS)) {
			return;
		}
		await this.dispatchTypingStart({channel, userId, personaId});
	}

	private async dispatchTypingStart({channel, userId, personaId}: {channel: Channel; userId: UserID; personaId?: PersonaID}): Promise<void> {
		await dispatchChannelEvent({
			gatewayService: this.gatewayService,
			channel,
			event: 'TYPING_START',
			data: {
				channel_id: channel.id.toString(),
				persona_id: personaId?.toString(),
				user_id: userId.toString(),
				timestamp: Math.floor(Date.now() / 1000),
			},
		});
	}
}
