// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import TypingIndicator from '@app/features/typing/state/TypingIndicator';

const logger = new Logger('Typing');

type TypingMutation = 'start' | 'stop';

async function postTypingIndicator(channelId: string, personaId?: string): Promise<void> {
	await http.post(Endpoints.CHANNEL_TYPING(channelId), { query: personaId ? { persona_id: personaId } : {} });
}

function logTypingSendFailure(channelId: string, error: unknown): void {
	logger.error(`Failed to send typing indicator to channel ${channelId}:`, error);
}

function updateTypingState(mutation: TypingMutation, channelId: string, userId: string, personaId?: string): void {
	if (mutation === 'start') {
		TypingIndicator.startRemoteTyping(channelId, userId, personaId);
		return;
	}
	TypingIndicator.stopTyping(channelId, userId);
}

export async function sendTyping(channelId: string, personaId?: string): Promise<void> {
	try {
		logger.debug(`Sending typing indicator to channel ${channelId}${personaId && ` with persona ${personaId}`}`);
		await postTypingIndicator(channelId, personaId);
		logger.debug(`Successfully sent typing indicator to channel ${channelId}${personaId && ` with persona ${personaId}`}`);
	} catch (error) {
		logTypingSendFailure(channelId, error);
	}
}

export function startTyping(channelId: string, userId: string, personaId?: string): void {
	logger.debug(`Starting typing indicator for user ${userId} in channel ${channelId}${personaId && ` with persona ${personaId}`}`);
	updateTypingState('start', channelId, userId, personaId);
}

export function stopTyping(channelId: string, userId: string): void {
	logger.debug(`Stopping typing indicator for user ${userId} in channel ${channelId}`);
	updateTypingState('stop', channelId, userId);
}

export function startLocalTyping(channelId: string, userId: string, personaId?: string): void {
	logger.debug(`Starting local typing indicator for user ${userId} in channel ${channelId}${personaId && ` with persona ${personaId}`}`);
	TypingIndicator.startLocalTyping(channelId, userId, personaId);
}

export function stopLocalTyping(channelId: string, userId: string): void {
	logger.debug(`Stopping local typing indicator for user ${userId} in channel ${channelId}`);
	TypingIndicator.stopLocalTyping(channelId, userId);
}
