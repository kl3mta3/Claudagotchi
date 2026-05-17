/**
 * MemoryManager.js
 * Manages the pet's persistent memory file at ~/.claudigotchi/pets/[name]/pet-memory.md
 * Memory is injected as context when pet generates speech via Claude API.
 */

const MAX_MEMORY_CHARS = 8000;   // ~2000 tokens
const SUMMARIZE_AT     = 12000;  // summarize when exceeding this

export class MemoryManager {
  constructor(petName) {
    this.petName = petName;
    this.memory  = null; // loaded content
    this.observations = []; // pending observations to append
  }

  async load() {
    if (!window.claudigotchi) return;
    const result = await window.claudigotchi.loadMemory({ petName: this.petName });
    if (result.ok && result.content) {
      this.memory = result.content;
    } else {
      this.memory = this._defaultMemory();
    }
    return this.memory;
  }

  async save() {
    if (!window.claudigotchi || !this.memory) return;
    await window.claudigotchi.saveMemory({ petName: this.petName, content: this.memory });
  }

  // Log a session start
  async onSessionStart({ projectFolder, timeOfDay }) {
    const obs = `- ${today()}: Session started in ${projectFolder ?? 'unknown project'} (${timeOfDay})`;
    await this._appendObservation('Recent Observations', obs);
  }

  // Log a notable event
  async logEvent(text) {
    await this._appendObservation('Recent Observations', `- ${today()}: ${text}`);
  }

  // Log evolution
  async logEvolution(stageName) {
    await this._appendObservation('Our History', `- Evolved to ${stageName}: ${today()}`);
  }

  // Log death
  async logDeath(cause) {
    await this._appendObservation('Our History', `- Died (${cause}): ${today()}`);
    await this.save();
  }

  // Log shop purchase
  async logPurchase(itemName) {
    await this._appendObservation('Recent Observations', `- ${today()}: Human bought ${itemName} for me`);
  }

  // Scan recent messages for notable patterns
  async observeMessages(messages) {
    if (!messages?.length) return;
    const combined = messages.map(m => m.content ?? '').join(' ');

    // Detect language patterns
    if (/\.(cs|csharp)\b/i.test(combined) && !this.memory?.includes('C#')) {
      await this._appendToSection('About My Human', '- Primary language appears to be C#');
    }
    if (/\.(py|python)\b/i.test(combined) && !this.memory?.includes('Python')) {
      await this._appendToSection('About My Human', '- Uses Python');
    }

    // Detect project names from folder paths or mentions
    // (Claude Code to expand this with more pattern matching)
  }

  // Get memory as context string for Claude API calls
  getContext() {
    if (!this.memory) return '';
    // Trim to max size for injection
    if (this.memory.length > MAX_MEMORY_CHARS) {
      return this.memory.slice(-MAX_MEMORY_CHARS);
    }
    return this.memory;
  }

  async _appendObservation(section, text) {
    if (!this.memory) await this.load();
    await this._appendToSection(section, text);
    // Auto-save and check if summarize needed
    if (this.memory.length > SUMMARIZE_AT) {
      await this._summarize();
    }
    await this.save();
  }

  async _appendToSection(sectionName, text) {
    const header = `## ${sectionName}`;
    if (this.memory.includes(header)) {
      this.memory = this.memory.replace(header, `${header}\n${text}`);
    } else {
      this.memory += `\n\n${header}\n${text}`;
    }
  }

  async _summarize() {
    // Keep recent observations, summarize older ones
    // Phase 6: call Claude API to summarize the older half
    // For now just trim oldest observations
    const lines = this.memory.split('\n');
    const recent = lines.slice(-Math.floor(lines.length / 2));
    this.memory = `# ${this.petName}'s Memory\n\n[Earlier memories summarized]\n\n` + recent.join('\n');
  }

  _defaultMemory() {
    return `# ${this.petName}'s Memory

## About My Human
- (learning...)

## Our History
- Born: ${today()}

## Recent Observations
`;
  }

  updatePetName(name) {
    this.petName = name;
    if (this.memory) {
      this.memory = this.memory.replace(/^# .+'s Memory/, `# ${name}'s Memory`);
    }
  }
}

function today() {
  return new Date().toISOString().split('T')[0];
}
