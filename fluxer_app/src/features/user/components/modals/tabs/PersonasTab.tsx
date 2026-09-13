import { SettingsTabContainer } from "@app/features/app/components/dialogs/shared/SettingsTabLayout";
import Users from "@app/features/user/state/Users";
import { Trans, useLingui } from "@lingui/react/macro";
import { observer } from "mobx-react-lite";
import styles from "./PersonasTab.module.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { runInAction } from "mobx";
import { fetchUserPersonas } from "@app/features/personas/commands/Personas";
import { Persona } from "@app/features/personas/models/Persona";
import Personas from "@app/features/user/state/Personas";
import { Avatar } from "@app/features/ui/components/Avatar";
import { ChevronRightIcon } from "@app/features/ui/action_menu/ContextMenuIcons";
import { Button } from "@app/features/ui/button/Button";
import { BugIcon, CircleIcon, DownloadIcon, PlusIcon, RadioButtonIcon } from "@phosphor-icons/react";
import { Tooltip } from "@app/features/ui/tooltip/Tooltip";
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import type { User } from "@app/features/user/models/User";
import { modal } from "@app/features/ui/commands/ModalCommands";
import { isKeyboardActivationKey } from "@app/features/input/utils/KeyboardUtils";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { PersonaEditorModal } from "../PersonaEditorModal";

const ACTIVATE_PERSONA_DESCRIPTOR = msg({
	message: "Make persona active",
	comment: "A tooltip for the button that activates a persona."
});
const DEACTIVATE_PERSONA_DESCRIPTOR = msg({
	message: "Make persona not active",
	comment: "A tooltip for the button that deactivates a persona."
});

interface PersonaTileProps {
	persona: Persona;
	user: User;
	selected: boolean;
	onSelect?: () => void;
}

const PersonaTile = observer(({persona, user, selected, onSelect} : PersonaTileProps) => {
	const handleOpen = useCallback(async () => {
		const usedPersona = Personas.getPersona(persona.id) ?? persona;
		ModalCommands.push(
			modal(() => (
				// <div>TEST</div>
				// <SwitchGroupSettingsModal
				// 	mode={mode}
				// 	title={title}
				// 	data-flx="user.advanced-settings-tab.advanced-chat-controls.handle-open.switch-group-settings-modal"
				// />
				<PersonaEditorModal
					initialPersona={usedPersona}
					data-flx="user.personas-tab.personas-tab-component.handle-open.persona-editor-modal"
				/>
			)),
		);
	}, [persona.id]);
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (isKeyboardActivationKey(e.key)) {
			handleOpen();
			e.preventDefault();
		}
	}, [])
	return <div className={styles.personaTile} role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
		<div className={styles.personaTileAvatarContainer}>
			<Avatar
					user={user}
					size={36}
					//className={className}
					//forceAnimate={isHovering}
					//guildId={guildId}
					personaId={persona?.id}
					personaAvatar={persona?.avatar}
					data-user-id={user!.id}
					//data-guild-id={guildId}
					data-persona-id={persona?.id}
					data-flx="user.personas-tab.personas-tab-component.persona-avatar"
				/>
		</div>
		<div className={styles.personaTileDetailsContainer}>
			<span className={styles.personaTileName}>{persona.internal_name || "<ERROR>"}</span>
			<span className={styles.personaTileTriggerRow}><span className={styles.personaTileTriggerChip}>{"[text]"}</span>{persona.triggers.map((v) => <span className={styles.personaTileTriggerChip}>`${v.prefix}text${v.prefix}`</span>)}</span>
		</div>
		<Tooltip text={selected ? i18n._(DEACTIVATE_PERSONA_DESCRIPTOR) : i18n._(ACTIVATE_PERSONA_DESCRIPTOR)}>
			<Button
				variant="inverted"
				square
				disabled={!onSelect}
				aria-label={selected ? i18n._(DEACTIVATE_PERSONA_DESCRIPTOR) : i18n._(ACTIVATE_PERSONA_DESCRIPTOR)}
				onClick={onSelect}
				icon={selected ? <RadioButtonIcon /> : <CircleIcon weight="regular" />}
			/>
		</Tooltip>
		<ChevronRightIcon />
	</div>;
});

const PERSONAS_TAB_ID = 'personas';
const PersonasTabComponent = observer(function PersonasTabComponent({
	//initialGuildId,
}: {
	//initialGuildId?: string;
} = {}) {
	const {i18n} = useLingui();
	const {current: user} = useRef(() => Users.currentUser);
	const [ariaAnnouncement, setAriaAnnouncement] = useState('');
	const [personas, setPersonas] = useState<Array<Persona>>([...Personas.getOwnPersonas()]);
	const [selectedDummy, setSelectedDummy] = useState<string | null>(personas[0]?.id ?? null);
	const personaUpdateCallback = useCallback(() => {
		const newPersonas = Personas.getOwnPersonas();
		if (newPersonas !== personas) {
			setPersonas([...newPersonas]);
		}
	}, [user]);
	useEffect(() => {
		runInAction(() => {
			fetchUserPersonas().then((personas) => {
				Personas.cachePersonas(personas);
				setPersonas(personas.map((v) => new Persona(v)));
				setSelectedDummy(personas[0]?.id);
				return Personas.subscribe(personaUpdateCallback);
			});
		})
	}, [user]);
	return <>
		<output
			aria-live="assertive"
			aria-atomic="true"
			className={styles.srOnly}
			data-flx="user.personas-tab.personas-tab-component.sr-only"
		>
			{ariaAnnouncement}
		</output>
		<SettingsTabContainer data-flx="user.personas-tab.personas-tab-component.settings-tab-container">
			<p data-flx="user.personas-tab.personas-tab-component.personas-explanation"><Trans>Personas are reusable profiles that you can attach to messages.</Trans></p>
			{/* <div className={styles.column}></div> */}
			{/* <Button onClick={() => Personas.personas = {}} leftIcon={<BugIcon />}>Reset</Button> */}
			<div className={styles.buttonRow}>
				<Button
					variant="secondary"
					leftIcon={<DownloadIcon />}
					onClick={() => {}}
					data-flx="user.personas-tab.personas-tab-component.import-personas-button"
				><Trans>Import...</Trans></Button>
				<Button
					variant="primary"
					leftIcon={<PlusIcon />}
					onClick={() => {
						ModalCommands.push(() => <PersonaEditorModal initialPersona={null} />)
					}}
					data-flx="user.personas-tab.personas-tab-component.create-personas-button"
				><Trans>Create Persona</Trans></Button>
			</div>
			{personas.map((v) => (<div key={v.id}><PersonaTile persona={v} user={user!} selected={selectedDummy === v.id} /></div>))}
		</SettingsTabContainer>
	</>;
});

export default PersonasTabComponent;
