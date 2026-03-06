import { readJSON, writeJSON } from '../core/storage.js';

const NOTES_KEY = 'jeff_toolbox_notes_v1';

function loadNotes() {
    const notes = readJSON(NOTES_KEY, []);
    if (!Array.isArray(notes)) {
        return [];
    }

    return notes
        .map(item => ({
            id: String(item.id || ''),
            title: String(item.title || '未命名笔记'),
            content: String(item.content || ''),
            imageData: item.imageData ? String(item.imageData) : '',
            createdAt: String(item.createdAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || new Date().toISOString())
        }))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function persistNotes(notes) {
    writeJSON(NOTES_KEY, notes);
}

function wrapLine(text, maxChars = 28) {
    const lines = [];
    let buffer = '';

    for (const char of text) {
        buffer += char;
        if (buffer.length >= maxChars) {
            lines.push(buffer.trim());
            buffer = '';
        }
    }

    if (buffer.trim()) {
        lines.push(buffer.trim());
    }

    return lines;
}

export function autoFormatNoteContent(rawText) {
    const normalized = String(rawText || '')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) {
        return '';
    }

    const sentenceReady = normalized.replace(/([。！？!?\.])\s*/g, '$1\n');
    const chunks = sentenceReady
        .split('\n')
        .map(chunk => chunk.trim())
        .filter(Boolean);

    const lines = [];
    for (const chunk of chunks) {
        lines.push(...wrapLine(chunk, 28));
    }

    return lines.join('\n');
}

export function getAllNotes() {
    return loadNotes();
}

export function addNote({ title, content, imageData }) {
    const notes = loadNotes();
    const now = new Date().toISOString();

    const formatted = autoFormatNoteContent(content);
    const note = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: String(title || '').trim() || '未命名笔记',
        content: formatted,
        imageData: String(imageData || ''),
        createdAt: now,
        updatedAt: now
    };

    notes.unshift(note);
    persistNotes(notes);
    return note;
}

export function deleteNote(noteId) {
    const notes = loadNotes();
    const filtered = notes.filter(note => note.id !== String(noteId));
    persistNotes(filtered);
    return filtered;
}
