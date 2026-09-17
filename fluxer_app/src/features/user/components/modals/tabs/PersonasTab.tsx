import { SettingsTabContainer } from "@app/features/app/components/dialogs/shared/SettingsTabLayout";
import Users from "@app/features/user/state/Users";
import { Trans, useLingui } from "@lingui/react/macro";
import { observer } from "mobx-react-lite";
import styles from "./PersonasTab.module.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runInAction } from "mobx";
import { fetchUserPersonas } from "@app/features/personas/commands/Personas";
import { Persona } from "@app/features/personas/models/Persona";
import Personas from "@app/features/user/state/Personas";
import { Avatar } from "@app/features/ui/components/Avatar";
import { ChevronRightIcon } from "@app/features/ui/action_menu/ContextMenuIcons";
import { Button } from "@app/features/ui/button/Button";
import { BugIcon, CircleIcon, DownloadIcon, PlusIcon, RadioButtonIcon, UserCirclePlusIcon, UserSwitchIcon } from "@phosphor-icons/react";
import { Tooltip } from "@app/features/ui/tooltip/Tooltip";
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import type { User } from "@app/features/user/models/User";
import { modal } from "@app/features/ui/commands/ModalCommands";
import { isKeyboardActivationKey } from "@app/features/input/utils/KeyboardUtils";
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { PersonaEditorModal } from "../PersonaEditorModal";
import { Slate } from "@app/features/app/components/dialogs/components/Slate";
import { StatusSlate } from "@app/features/app/components/dialogs/shared/StatusSlate";

const ACTIVATE_PERSONA_DESCRIPTOR = msg({
	message: "Make persona active",
	comment: "A tooltip for the button that activates a persona."
});
const DEACTIVATE_PERSONA_DESCRIPTOR = msg({
	message: "Make persona not active",
	comment: "A tooltip for the button that deactivates a persona."
});
const NO_PERSONAS_DESCRIPTOR = msg({
	message: "No personas yet",
	comment: "Slate title that shows in the Personas tab when there are no personas."
});
const CREATE_A_PERSONA_TO_GET_STARTED_DESCRIPTOR = msg({
	//message: "Create a persona to get started.",
	message: "My name is Darth Vader. I am an extra-terrestrial from the planet Vulcan!",
	comment: "Slate message that shows in the Personas tab when there are no personas."
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
			<span className={styles.personaTileTriggerRow}>{persona.triggers.map((v) => <span className={styles.personaTileTriggerChip}>{`${v.prefix||""}message${v.suffix||""}`}</span>)}</span>
		</div>
		<Tooltip text={selected ? i18n._(DEACTIVATE_PERSONA_DESCRIPTOR) : i18n._(ACTIVATE_PERSONA_DESCRIPTOR)}>
			<Button
				variant="secondary"
				square
				disabled={!onSelect}
				aria-label={selected ? i18n._(DEACTIVATE_PERSONA_DESCRIPTOR) : i18n._(ACTIVATE_PERSONA_DESCRIPTOR)}
				onClick={(e: React.MouseEvent) => {
					e.stopPropagation();
					onSelect?.();
				}}
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
	const user = useMemo(() => Users.currentUser, []);
	const [ariaAnnouncement, setAriaAnnouncement] = useState('');
	const [personas, setPersonas] = useState<Array<Persona>>([...Personas.getOwnPersonas()]);
	const [selected, updateSelected] = useState(() => Personas.getGlobalActivePersona());

	const personaUpdateCallback = useCallback(() => {
		const newPersonas = Personas.getOwnPersonas();
		if (newPersonas !== personas) {
			setPersonas([...newPersonas]);
			updateSelected(Personas.getGlobalActivePersona());
		}
	}, [user]);
	useEffect(() => {
		runInAction(() => {
			fetchUserPersonas().then((personas) => {
				Personas.cachePersonas(personas);
				setPersonas(personas.map((v) => new Persona(v)));
				updateSelected(Personas.getGlobalActivePersona());
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
					disabled
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
			{personas.map((v) => (<div key={v.id}><PersonaTile
				persona={v}
				user={user!}
				selected={selected?.id === v.id}
				onSelect={() => runInAction(() => {
					if (selected?.id === v.id) {
						Personas.setGlobalActivePersona("");
					} else {
						Personas.setGlobalActivePersona(v.id);
					}
					updateSelected(Personas.getGlobalActivePersona());
				})}
			/></div>))}
			{personas.length === 0 && <StatusSlate
				Icon={UserCirclePlusIcon}
				title={i18n._(NO_PERSONAS_DESCRIPTOR)}
				description={i18n._(CREATE_A_PERSONA_TO_GET_STARTED_DESCRIPTOR)}
			/>}
		</SettingsTabContainer>
	</>;
});

export default PersonasTabComponent;
