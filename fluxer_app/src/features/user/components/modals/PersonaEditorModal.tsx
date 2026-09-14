import * as Modal from '@app/features/app/components/dialogs/Modal';
import { Persona } from '@app/features/personas/models/Persona';
import { i18n } from "@lingui/core";
import { msg } from '@lingui/core/macro';
import { observer } from 'mobx-react-lite';
import profileStyles from '@app/features/user/components/modals/tabs/MyProfileTab.module.css';
import { Form } from '@app/features/ui/components/form/Form';
import {useForm, useWatch} from 'react-hook-form';
import { Input } from '@app/features/ui/components/form/FormInput';
import { Trans, useLingui } from '@lingui/react/macro';
import { DISPLAY_NAME_DESCRIPTOR, DOC_I_M_FROM_THE_FUTURE_I_CAME_DESCRIPTOR, PRONOUNS_DESCRIPTOR } from './tabs/MyProfileTab';
import { SettingsSection } from '@app/features/app/components/dialogs/shared/SettingsSection';
import styles from '@app/features/user/components/modals/PersonaEditorModal.module.css';
import previewStyles from '@app/features/user/components/profile/ProfilePreview.module.css';
import { clsx } from 'clsx';
import Users from '../../state/Users';
import { ProfilePreview } from '../profile/ProfilePreview';
import { Button } from '@app/features/ui/button/Button';
import { modal } from '@app/features/ui/commands/ModalCommands';
import { Modals } from '@app/features/app/components/dialogs/Modals';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import * as UnsavedChangesCommands from '@app/features/ui/commands/UnsavedChangesCommands';
import * as PersonaCommands from '@app/features/personas/commands/Personas';
import type { PersonaPatchRequest } from '@fluxer/schema/src/domains/persona/PersonaSchemas.js';
import { useFormSubmit } from '@app/features/app/hooks/useFormSubmit';
import { AccentColorPicker } from './tabs/my_profile_tab/AccentColorPicker';
import { useRemoteFormReset } from '@app/lib/forms/RemoteFormReset';
import Personas from '../../state/Personas';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import { DeleteIcon } from '@app/features/ui/action_menu/ContextMenuIcons';
import { ConfirmModal } from '@app/features/app/components/dialogs/ConfirmModal';
import { BioEditor } from './tabs/my_profile_tab/BioEditor';
import type { MentionSegment } from '@app/features/messaging/utils/TextareaSegmentManager';
import type { LexicalRichInputHandle } from '@app/features/lexical/composer/LexicalRichInput';
import type { FlatEmoji } from '@app/features/emoji/types/EmojiTypes';
import MobileLayout from '@app/features/ui/state/MobileLayout';
import { AvatarUploader } from './tabs/my_profile_tab/AvatarUploader';
import { BannerUploader } from './tabs/my_profile_tab/BannerUploader';
import { PersonaProfileCard } from '../profile/PersonaProfile';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';

const EDIT_PERSONA_DESCRIPTOR = msg({
	message: 'Edit Persona',
	comment: "The title of the persona editor modal."
});
const CREATE_PERSONA_DESCRIPTOR = msg({
	message: 'New Persona',
	comment: "The title of the persona editor modal when it's being used to create a new persona."
});
const INTERNAL_NAME_DESCRIPTOR = msg({
	message: 'Internal Name',
	comment: "Label in the persona editor for a private name for a persona."
});
const PERSONA_UPDATED_DESCRIPTOR = msg({
	message: 'Persona updated',
	comment: "Short label in the persona editor. Keep it concise."
});
const PERSONA_CREATED_DESCRIPTOR = msg({
	message: 'Persona created',
	comment: "Short label in the persona editor. Keep it concise."
});
const PERSONA_DELETED_DESCRIPTOR = msg({
	message: 'Persona deleted',
	comment: "Short label in the persona editor. Keep it concise."
});

interface PersonaEditorModalProps {
	initialPersona: Persona | null;
}

interface FormInputs {
	avatar?: string | null;
	banner?: string | null;
	bio: string | null;
	internal_name: string | null;
	display_name: string | null;
	pronouns: string | null;
	accent_color: number | null;
}

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = observer(
	({initialPersona}) => {
		console.log("Using persona", initialPersona, Personas.allPersonasList);
		const [savedPersona, setSavedPersona] = useState(initialPersona);
		const {i18n} = useLingui();
		const user = useMemo(() => Users.currentUser!, []);
		const form = useForm<FormInputs>({
			defaultValues: {...initialPersona, avatar: undefined, banner: undefined},
		});
		const [bioHydrationKey, setBioHydrationKey] = useState(0);
		const onSubmit = useCallback(
			async (data: FormInputs) => {
				if (savedPersona) {
					const updateData: PersonaPatchRequest = {
						avatar: data.avatar,
						banner: data.banner,
						bio: data.bio,
						internal_name: data.internal_name || undefined,
						display_name: data.display_name || undefined,
						pronouns: data.pronouns,
						accent_color: data.accent_color,
					};
					const newPersona = await PersonaCommands.update(initialPersona!.id, updateData);
					form.reset({...newPersona, avatar: null, banner: null});
					Personas.cachePersonas([newPersona]);
					ToastCommands.createToast({type: 'success', children: i18n._(PERSONA_UPDATED_DESCRIPTOR)});
					setSavedPersona(new Persona(newPersona));
				} else {
					// Create a persona
					const newPersona = await PersonaCommands.create({
						...form.getValues(),
						internal_name: form.getValues().internal_name!,
						triggers: [],
					});
					//form.reset({...newPersona, avatar: null, banner: null});
					Personas.cachePersonas([newPersona]);
					ModalCommands.pop();
					ToastCommands.createToast({type: 'success', children: i18n._(PERSONA_CREATED_DESCRIPTOR)});
					setSavedPersona(new Persona(newPersona));
				}
			},
			[
				// commitProfileFormValues,
				// isPerGuildProfile,
				// isProfileCustomizationLocked,
				// hasProfileTimezoneAccess,
				// selectedGuildId,
				user,
				initialPersona,
				// activeProfileData,
				// avatarAsset,
				// bannerAsset,
				// profileIdentityKey,
			],
		);
		const handleReset = useCallback(() => {
			// TODO: Get new default values, i.e. what was submitted last
			form.reset();
			setBioValue(form.formState.defaultValues?.bio ?? "");
			setBioActualValue(form.formState.defaultValues?.bio ?? "");
			setBioSegments([]);
			setBioHydrationKey((key) => key + 1);
		}, [savedPersona]);
		const {handleSubmit: handleSave} = useFormSubmit({
			form,
			onSubmit,
			defaultErrorField: 'internal_name',
		});
		const handleDelete = useCallback(async () => {
			if (!savedPersona) return;
			ModalCommands.push(() => <ConfirmModal
				title="Delete this persona?"
				description={`You are about to delete ${savedPersona.internal_name}. Are you sure this is what you want to do?`}
				onPrimary={async () => {
					await PersonaCommands.deletePersona(savedPersona.id);
					Personas.removePersona(savedPersona.id);
					ToastCommands.createToast({type: 'success', children: i18n._(PERSONA_DELETED_DESCRIPTOR)});
					ModalCommands.popAllByType(PersonaEditorModal);
				}}
				primaryText={<Trans>Delete</Trans>}
			/>)
		}, [savedPersona]);

		const bioComposerRef = useRef<LexicalRichInputHandle | null>(null);
		const [bioValue, setBioValue] = useState(form.formState.defaultValues?.bio ?? "");
		const [bioActualValue, setBioActualValue] = useState(bioValue);
		const [bioSegments, setBioSegments] = useState<Array<MentionSegment>>([]);
		const [bioExpressionPickerOpen, setBioExpressionPickerOpen] = useState(false);
		const handleBioChange = useCallback((display: string, segments: Array<MentionSegment>, wire: string) => {
			const bio = form.getFieldState("bio");
			const ogBio = form.formState.defaultValues?.bio;
			console.log("og bio was:", ogBio);
			console.log("bio was:", bioActualValue);
			console.log("changed bio:", wire);
			if (wire !== bioActualValue) form.setValue("bio", wire, {
				shouldDirty: bio.isDirty || wire !== ogBio,
				shouldTouch: true,
				shouldValidate: true
			});
			setBioValue(display);
			setBioSegments(segments);
			setBioActualValue(wire);
		}, []);
		useWatch({
			control: form.control,
			name: ['bio'],
			compute: ([wireValue]) => {
				if (wireValue === bioActualValue) return;
				//if (wireValue === null) return;
				setBioValue(wireValue || "");
				setBioSegments([]);
				setBioActualValue(wireValue || "");
			}
		});
		const handleBioEmojiSelect = useCallback((emoji: FlatEmoji, shiftKey?: boolean) => {
			const composer = bioComposerRef.current;
			if (composer == null) {
				return false;
			}
			const didInsert = composer.insertEmoji(emoji);
			if (didInsert && shiftKey !== true) {
				setBioExpressionPickerOpen(false);
			}
			return didInsert;
		}, []);
		const actualBio = bioActualValue;
		const maxBioActualLength = user?.maxBioLength ?? 0;

		const setAvatarHandler = useCallback((b64val: string) => {
			form.setValue("avatar", b64val, {
				shouldDirty: true,
				shouldTouch: true
			});
		}, [savedPersona]);
		const clearAvatarHandler = useCallback(() => {
			form.setValue("avatar", null, {
				shouldDirty: true,
				shouldTouch: true
			});
		}, [savedPersona]);
		const hasAvatar = !!savedPersona?.avatar || !!form.watch("avatar");

		const setBannerHandler = useCallback((b64val: string) => {
			form.setValue("banner", b64val, {
				shouldDirty: true,
				shouldTouch: true
			});
		}, [savedPersona]);
		const clearBannerHandler = useCallback(() => {
			form.setValue("banner", null, {
				shouldDirty: true,
				shouldTouch: true
			});
		}, [savedPersona]);
		const hasBanner = !!savedPersona?.banner || !!form.watch("banner");

		/* TODO: still need UnsavedChanges */
		return <Modal.Root size={"large"}>
			<Modal.Header title={initialPersona ? i18n._(EDIT_PERSONA_DESCRIPTOR) : i18n._(CREATE_PERSONA_DESCRIPTOR)} />
			<Modal.Content>
				<Form
					form={form}
					onSubmit={onSubmit}
					data-flx="user.persona-editor-modal.form.submit"
				>
					<div
						className={clsx(profileStyles.contentLayout)}
						data-flx="user.persona-editor-modal.content-layout"
					>
						<div className={profileStyles.formColumn} data-flx="user.persona-editor-modal.form-column">
							<Input
								data-flx="user.persona-editor-modal.input--internal-name"
								label={i18n._(INTERNAL_NAME_DESCRIPTOR)}
								footer={<span className={styles.footerHintText}><Trans>This name stays private, and only appears in lists of your own personas.</Trans></span>}
								{...form.register('internal_name')}
								value={form.watch('internal_name') || ''}
								required
							/>
							<Input
								data-flx="user.persona-editor-modal.input--display-name"
								label={i18n._(DISPLAY_NAME_DESCRIPTOR)}
								{...form.register('display_name')}
								value={form.watch('display_name') || ''}
							/>
							<Input
								data-flx="user.persona-editor-modal.input--pronouns"
								label={i18n._(PRONOUNS_DESCRIPTOR)}
								{...form.register('pronouns')}
								value={form.watch('pronouns') || ''}
							/>
							<div data-flx="user.persona-editor-modal.avatar-uploader-outer">
								<AvatarUploader
									hasAvatar={hasAvatar}
									requireAnimatedAvatarEntitlement={true}
									onAvatarChange={setAvatarHandler}
									onAvatarClear={clearAvatarHandler}
									//disabled={isProfileCustomizationLocked || isPerGuildProfileCustomizationDisabled}
									//disableModeSelection={isProfileCustomizationLocked}
									isPerGuildProfile={false}
									errorMessage={form.formState.errors.avatar?.message}
									avatarMode={hasAvatar ? "custom" : "unset"}
									//onAvatarModeChange={handleAvatarModeChange}
									data-flx="user.persona-editor-modal.avatar-uploader"
								/>
							</div>
							<div data-flx="user.persona-editor-modal.banner-upload-outer">
								<BannerUploader
									hasBanner={hasBanner}
									onBannerChange={setBannerHandler}
									onBannerClear={clearBannerHandler}
									requireBannerEntitlement={true}
									hideUploadWhenMissingEntitlement={true}
									isPerGuildProfile={false}
									errorMessage={form.formState.errors.banner?.message}
									bannerMode={hasBanner ? "custom" : "unset"}
									//onBannerModeChange={handleBannerModeChange}
									data-flx="user.persona-editor-modal.banner-uploader"
								/>
							</div>
							<div
								// className={isPerGuildProfile && !hasPerGuildProfiles ? styles.opacityHalf : ''}
								// data-flx="user.persona-editor-modal.opacity-half"
							>
								<AccentColorPicker
									value={form.watch('accent_color') ?? null}
									onChange={(value: number | null) => form.setValue('accent_color', value, {shouldDirty: true})}
									//disabled={isProfileCustomizationLocked || isPerGuildProfileCustomizationDisabled}
									errorMessage={form.formState.errors.accent_color?.message}
									data-flx="user.persona-editor-modal.accent-color-picker.set-value"
								/>
							</div>
							<div
								//className={isPerGuildProfile && !hasPerGuildProfiles ? styles.opacityHalf : ''}
								//data-flx="user.my-profile-tab.my-profile-tab-component.opacity-half--2"
							>
								<BioEditor
									{...form.register('bio')}
									initialValue={bioValue}
									initialSegments={bioSegments}
									hydrationKey={bioHydrationKey}
									onChange={handleBioChange}
									onEmojiSelect={handleBioEmojiSelect}
									placeholder={
										i18n._(DOC_I_M_FROM_THE_FUTURE_I_CAME_DESCRIPTOR)
									}
									actualLength={actualBio.length}
									actualMaxLength={maxBioActualLength}
									disabled={false}
									// disabled={isProfileCustomizationLocked || isPerGuildProfileCustomizationDisabled}
									isMobile={MobileLayout.enabled}
									errorMessage={
										form.formState.errors.bio != null && form.formState.errors.bio.message != null
											? form.formState.errors.bio.message
											: null
									}
									composerRef={bioComposerRef}
									emojiPickerOpen={bioExpressionPickerOpen}
									onEmojiPickerOpenChange={setBioExpressionPickerOpen}
									data-flx="user.persona-editor-modal.bio-editor.bio-change"
								/>
							</div>
						</div>
						<div
							className={profileStyles.previewColumn}
							data-flx="user.persona-editor-modal.preview-column"
						>
							{/* <ProfilePreview
								user={user}
							/> */}
							<FocusRing offset={-2} data-flx="user.profile.profile-preview.focus-ring">
								<div
									className={previewStyles.previewInteractive}
									role="group"
									//aria-label={i18n._(PROFILE_PREVIEW_PRESS_ENTER_TO_OPEN_FULL_PREVIEW_DESCRIPTOR)}
									onKeyDown={/*handlePreviewKeyDown*/() => {}}
									data-flx="user.profile.profile-preview.preview-interactive.preview-key-down"
								>
									{savedPersona && <PersonaProfileCard
										user={user}
										persona={savedPersona!}
										showPreviewLabel
									/>}
								</div>
							</FocusRing>
						</div>
					</div>
				</Form>
			</Modal.Content>
			<Modal.FormFooter>
				{form.formState.isDirty && <span className={styles.unsavedChangesWarning}><Trans>You have unsaved changes.</Trans></span>}
				{!form.formState.isDirty && initialPersona && <Button
					variant="danger"
					className={styles.deleteButton}
					leftIcon={<DeleteIcon />}
					disabled={form.formState.isLoading || !form.formState.isValid}
					onClick={handleDelete}
				><Trans>Delete</Trans></Button>}
				<Button variant="secondary" disabled={form.formState.isLoading || !form.formState.isValid || !form.formState.isDirty} onClick={handleReset}>Reset</Button>
				<Button variant="primary" disabled={form.formState.isLoading || !form.formState.isValid || !form.formState.isDirty} onClick={handleSave}>Save</Button>
			</Modal.FormFooter>
		</Modal.Root>;
	});
