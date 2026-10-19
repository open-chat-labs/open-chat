// Which entries of a doc's contents list are open (showing their sub-sections). The ones on the way to the section
// being read open by themselves, and close again when the reader moves on; an entry the reader opens stays open until
// they close it, and one they close while reading it stays closed until they move on from it.
export class TocOpen {
  // the reader's own choices, by section index
  #chosen = $state<Record<number, boolean>>({});
  // the entries on the way to the section being read, by section index
  #reading = $state<number[]>([]);

  isOpen(index: number): boolean {
    return this.#chosen[index] ?? this.#reading.includes(index);
  }

  toggle(index: number): void {
    this.#chosen[index] = !this.isOpen(index);
  }

  /** The reader moved on: `path` is the entries (section indexes) from the top to the section now being read. */
  reading(path: number[]): void {
    for (const index of this.#reading) {
      // a close lasts while its section is being read
      if (!path.includes(index) && this.#chosen[index] === false) delete this.#chosen[index];
    }
    this.#reading = path;
  }
}
