/** True quando algum campo de texto está focado (o input do jogo deve ignorar teclas). */
export function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "range", "color"].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}
