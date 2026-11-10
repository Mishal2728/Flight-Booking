import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, ImagePlus, MapPin, Plus, Settings2, Trash2, X } from 'lucide-react';
import type { DestinationItem } from './destinations';

type Props = {
  destinations: DestinationItem[];
  onSave: (destinations: DestinationItem[]) => void;
};

const blankDestination: DestinationItem = {
  code: '', name: '', country: '', tag: '', image: '', imagePosition: '',
};

function canvasBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, mime, quality));
}

async function optimizeUpload(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 1440 / image.naturalWidth, 1000 / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await canvasBlob(canvas, 'image/webp', .78);
    if (!blob) blob = await canvasBlob(canvas, 'image/jpeg', .76);
    if (blob && blob.size > 950 * 1024) blob = await canvasBlob(canvas, 'image/webp', .62);
    if (!blob || blob.size > 1.2 * 1024 * 1024) throw new Error('Image is too large to save in browser storage. Try a smaller image.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read.'));
      reader.onerror = () => reject(new Error('Image could not be read.'));
      reader.readAsDataURL(blob!);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function DestinationManager({ destinations, onSave }: Props) {
  const [draft, setDraft] = useState<DestinationItem | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startNew = () => {
    setEditingCode(null);
    setDraft({ ...blankDestination });
    setError('');
    setSaved(false);
    setPendingDeleteCode(null);
  };
  const startEdit = (item: DestinationItem) => {
    setEditingCode(item.code);
    setDraft({ ...item });
    setError('');
    setSaved(false);
    setPendingDeleteCode(null);
  };
  const close = () => {
    setDraft(null);
    setEditingCode(null);
    setError('');
  };
  const update = (patch: Partial<DestinationItem>) => setDraft(current => current ? { ...current, ...patch } : current);
  const handleUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      update({ image: await optimizeUpload(file) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare that image.');
    } finally {
      setUploading(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    const code = draft.code.trim().toUpperCase();
    const image = draft.image.trim();
    if (!/^[A-Z]{3}$/.test(code)) {
      setError('Enter a three-letter IATA airport code.');
      return;
    }
    if (destinations.some(item => item.code === code && item.code !== editingCode)) {
      setError('That airport code is already in the destination list.');
      return;
    }
    if (!/^(https?:\/\/|\/(?!\/)|data:image\/(?:webp|png|jpeg);base64,)/i.test(image)) {
      setError('Use an HTTPS image URL, a site-relative path, or upload an image.');
      return;
    }
    const normalized = { ...draft, code, image, name: draft.name.trim(), country: draft.country.trim(), tag: draft.tag.trim() };
    const next = editingCode
      ? destinations.map(item => item.code === editingCode ? normalized : item)
      : [...destinations, normalized];
    try {
      onSave(next);
      setSaved(true);
      setError('');
      setDraft(null);
      setEditingCode(null);
    } catch {
      setError('Could not save this change in the current browser.');
    }
  };
  const removeDestination = (code: string) => {
    try {
      onSave(destinations.filter(item => item.code !== code));
      setPendingDeleteCode(null);
      setSaved(true);
      if (editingCode === code) close();
    } catch {
      setError('Could not remove this destination from browser storage.');
    }
  };

  return <div className="panel table-panel full-panel destination-manager">
    <div className="panel-title destination-manager__header">
      <div><b>Featured destinations</b><span>Edit the cards shown on the public homepage.</span></div>
      <button className="small-primary" type="button" onClick={startNew}><Plus size={14} /> Add destination</button>
    </div>
    <div className="destination-manager__notice" role="note">
      <MapPin size={15} /> Browser-local editor: destination text, image uploads and URLs are saved on this device only. This project has no destination CRUD endpoint, so changes are not published to the backend.
    </div>
    {saved && <p className="destination-manager__saved" role="status">Destination list saved in this browser.</p>}
    <div className="destination-manager__list">
      {destinations.map(item => <article className="destination-manager__item" key={item.code}>
        <img src={item.image} alt="" loading="lazy" />
        <div className="destination-manager__item-copy"><span>{item.code} · {item.country}</span><b>{item.name}</b><small>{item.tag}</small></div>
        {pendingDeleteCode === item.code
          ? <div className="destination-manager__confirm"><button type="button" onClick={() => removeDestination(item.code)}>Delete</button><button type="button" onClick={() => setPendingDeleteCode(null)}>Cancel</button></div>
          : <div className="destination-manager__row-actions"><button type="button" className="destination-manager__edit" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`}><Settings2 size={14} /> Edit</button><button type="button" className="destination-manager__delete" onClick={() => setPendingDeleteCode(item.code)} aria-label={`Delete ${item.name}`}><Trash2 size={14} /></button></div>}
      </article>)}
      {!destinations.length && <div className="empty-admin">No featured destinations yet. Add one to show it on the homepage.</div>}
    </div>
    {draft && <form className="destination-manager__form" onSubmit={submit}>
      <div className="destination-manager__form-head"><div><b>{editingCode ? `Edit ${draft.name}` : 'Add a destination'}</b><small>Use a valid airport code; flight availability still depends on the existing search service.</small></div><button type="button" className="destination-manager__close" onClick={close} aria-label="Close destination editor"><X size={17} /></button></div>
      <div className="destination-manager__fields">
        <label>Airport code<input required autoComplete="off" maxLength={3} pattern="[A-Za-z]{3}" value={draft.code} disabled={Boolean(editingCode)} onChange={event => update({ code: event.target.value.toUpperCase() })} placeholder="e.g. SIN" /></label>
        <label>Destination name<input required autoComplete="off" maxLength={48} value={draft.name} onChange={event => update({ name: event.target.value })} placeholder="e.g. Singapore" /></label>
        <label>Country<input required autoComplete="off" maxLength={56} value={draft.country} onChange={event => update({ country: event.target.value })} placeholder="e.g. Singapore" /></label>
        <label>Short description<input required autoComplete="off" maxLength={72} value={draft.tag} onChange={event => update({ tag: event.target.value })} placeholder="e.g. Gardens, islands and city lights" /></label>
        <label className="destination-manager__image-url">Image URL or site path<input required autoComplete="off" type="text" value={draft.image.startsWith('data:image/') ? 'Uploaded image (optimized)' : draft.image} onChange={event => update({ image: event.target.value })} placeholder="e.g. https://example.com/singapore.jpg"/></label>
        <label className="destination-manager__upload"><span><ImagePlus size={14}/> Upload image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => { void handleUpload(event.target.files?.[0]); event.currentTarget.value = ''; }}/><small>{uploading ? 'Optimizing image…' : 'e.g. singapore-view.webp · JPG, PNG or WebP; resized for browser storage.'}</small></label>
        <label>Image position<input required autoComplete="off" value={draft.imagePosition} onChange={event => update({ imagePosition: event.target.value })} placeholder="e.g. 50% center" /></label>
      </div>
      {draft.image && <div className="destination-manager__preview"><img src={draft.image} alt="Destination image preview"/><span>Image preview</span></div>}
      {error && <p className="destination-manager__error" role="alert">{error}</p>}
      <div className="destination-manager__actions"><button type="button" className="destination-manager__cancel" onClick={close}>Cancel</button><button type="submit" className="small-primary" disabled={uploading}>{uploading ? 'Preparing image…' : 'Save destination'} <ArrowRight size={14} /></button></div>
    </form>}
  </div>;
}
