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
import { SettingsSection } from "@app/features/app/components/dialogs/shared/SettingsSection";
import { RadioGroup } from "@app/features/ui/radio_group/RadioGroup";
import { PersonaSettings_LatchMode } from "@fluxer/schema/src/gen/fluxer/user/preferences/v1/preferences_pb.js";

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

export const LATCH_OFF_DESCRIPTOR = msg({
	message: "Off",
	comment: "A label for the latching modes (trigger behavior) setting."
});
const LATCH_OFF_DESCRIPTION_DESCRIPTOR = msg({
	message: "Triggers don't activate personas at all.",
	comment: "A label for the latching modes (trigger behavior) setting."
});
export const LATCH_MANUAL_DESCRIPTOR = msg({
	message: "Manual",
	comment: "A label for the latching modes (trigger behavior) setting."
});
const LATCH_MANUAL_DESCRIPTION_DESCRIPTOR = msg({
	message: "A trigger sends a message with its persona, but the active persona doesn't change.",
	comment: "A label for the latching modes (trigger behavior) setting."
});
export const LATCH_TRIGGER_SWITCHING_DESCRIPTOR = msg({
	message: "Last Used",
	comment: "A label for the latching modes (trigger behavior) setting."
});
const LATCH_TRIGGER_SWITCHING_DESCRIPTION_DESCRIPTOR = msg({
	message: "A trigger sets its persona as active until the active persona is changed. This may also be called \"latching\".",
	comment: "A label for the latching modes (trigger behavior) setting."
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
			<SettingsSection
				tabType="personas"
				isAdvanced
				linkable
				defaultExpanded={false}
				description={<Trans>Set what happens when you send a message using a persona's trigger.</Trans>}
				id="persona-latch-mode"
				title={<Trans>Trigger Behavior</Trans>}
			>
				<RadioGroup
					value={Personas.latchMode}
					onChange={(v) => Personas.latchMode = v}
				  options={[
						{
							value: PersonaSettings_LatchMode.OFF,
							name: i18n._(LATCH_OFF_DESCRIPTOR),
							desc: i18n._(LATCH_OFF_DESCRIPTION_DESCRIPTOR)
						},
						{
							value: PersonaSettings_LatchMode.MANUAL,
							name: i18n._(LATCH_MANUAL_DESCRIPTOR),
							desc: i18n._(LATCH_MANUAL_DESCRIPTION_DESCRIPTOR)
						},
						{
							value: PersonaSettings_LatchMode.TRIGGER_SWITCHING,
							name: i18n._(LATCH_TRIGGER_SWITCHING_DESCRIPTOR),
							desc: i18n._(LATCH_TRIGGER_SWITCHING_DESCRIPTION_DESCRIPTOR)
						},
					]}
				/>
			</SettingsSection>
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
