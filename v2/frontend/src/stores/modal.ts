import { writable } from "svelte/store";

export enum ModalType {
    NoModal,
    TestMode,
    ThemeSelection,
    JoinGroup,
}

const { subscribe, update } = writable<ModalType>(ModalType.NoModal);

export const modalStore = {
    subscribe,
    showModal: (type: ModalType): void => update(() => type),
    hideModal: (): void => update(() => ModalType.NoModal),
};
