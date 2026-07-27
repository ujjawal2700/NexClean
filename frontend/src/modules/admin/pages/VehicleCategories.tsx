import { useState } from "react";
import { Plus, Trash2, Layers, Upload, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { CarSilhouette } from "@shared/components/visual/CarSilhouette";
import { formatMoney } from "@shared/lib/format";
import { convertToWebP } from "@shared/lib/imageUtils";
import {
  useVehicleCategories,
  useCreateVehicleCategory,
  useUpdateVehicleCategory,
  useDeleteVehicleCategory,
  useUploadMedia,
} from "../api/admin.api";
import type { VehicleCategory } from "../types";

function CategoryCard({ category }: { category: VehicleCategory }) {
  const update = useUpdateVehicleCategory();
  const remove = useDeleteVehicleCategory();
  const uploadMedia = useUploadMedia();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [basePrice, setBasePrice] = useState(String(category.basePrice));
  const [imageUrl, setImageUrl] = useState(category.imageUrl || "");
  const [preview, setPreview] = useState(category.imageUrl || "");
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProcessing(true);
      const webpBase64 = await convertToWebP(file);
      setPreview(webpBase64);
      const res = await uploadMedia.mutateAsync(webpBase64);
      setImageUrl(res.imageUrl);
      setPreview(res.imageUrl);
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Failed to convert and upload image.");
    } finally {
      setProcessing(false);
    }
  };

  const save = () => {
    update.mutate(
      {
        id: category.id,
        name: name.trim() || category.name,
        basePrice: Number(basePrice) || category.basePrice,
        imageUrl,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const remove_ = () => {
    if (window.confirm(`Delete the "${category.name}" category? This can't be undone.`)) {
      remove.mutate(category.id);
    }
  };

  return (
    <GlassCard className={category.active ? "" : "opacity-60"}>
      <div className="mb-3 h-20 flex items-center justify-center overflow-hidden rounded-xl bg-surface/50 p-2">
        <CarSilhouette
          type={category.key}
          imageUrl={editing ? preview : category.imageUrl}
          uid={`cat-${category.key}`}
          className="mx-auto h-full w-auto max-h-16"
        />
      </div>

      {editing ? (
        <div className="space-y-3">
          <Input name={`name-${category.id}`} label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Base price (₹)</label>
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/50">
              <span className="text-muted">₹</span>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="h-10 w-full bg-transparent text-ink outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Vehicle Image (WebP Cloudinary)</label>
            <div className="flex items-center gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface p-2 text-xs text-muted hover:border-primary/50 hover:text-ink">
                {processing ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Upload className="size-4 text-primary" />
                )}
                <span>{processing ? "Converting..." : "Upload & Convert to WebP"}</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  disabled={processing}
                  onChange={handleFileChange}
                />
              </label>
              {imageUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setImageUrl("");
                    setPreview("");
                  }}
                  title="Clear Image"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" disabled={update.isPending || processing} onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-center font-display text-lg font-semibold text-ink">{category.name}</p>
          <p className="text-center text-sm text-muted">{formatMoney(category.basePrice)} base price</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: category.id, active: !category.active })}
            >
              {category.active ? "Active" : "Inactive"}
            </Button>
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={remove_}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function NewCategoryForm({ onClose }: { onClose: () => void }) {
  const create = useCreateVehicleCategory();
  const uploadMedia = useUploadMedia();

  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProcessing(true);
      const webpBase64 = await convertToWebP(file);
      setPreview(webpBase64);
      const res = await uploadMedia.mutateAsync(webpBase64);
      setImageUrl(res.imageUrl);
      setPreview(res.imageUrl);
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Failed to convert and upload image.");
    } finally {
      setProcessing(false);
    }
  };

  const submit = () => {
    if (!name.trim() || !basePrice) return;
    create.mutate(
      { name: name.trim(), basePrice: Number(basePrice) || 0, imageUrl },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <GlassCard>
      <p className="font-display text-lg font-semibold text-ink">New vehicle category</p>

      {preview && (
        <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-surface/60 p-2">
          <img src={preview} alt="Preview" className="max-h-20 max-w-full object-contain" />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input name="catName" label="Name" placeholder="Convertible" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          name="catPrice"
          label="Base price (₹)"
          type="number"
          placeholder="599"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-muted">Vehicle Category Image (Optional)</label>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface p-3 text-sm text-muted hover:border-primary/50 hover:text-ink">
            {processing ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <ImageIcon className="size-4 text-primary" />
            )}
            <span>{processing ? "Converting to WebP & Uploading..." : "Choose PNG, JPG, JPEG (Auto-converts to WebP)"}</span>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
              disabled={processing}
              onChange={handleFileChange}
            />
          </label>
          {imageUrl && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setImageUrl("");
                setPreview("");
              }}
              title="Clear Image"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Uploaded images are converted to WebP format before being uploaded to Cloudinary to save bandwidth and storage.
      </p>

      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={create.isPending || processing || !name.trim() || !basePrice}>
          <Plus className="size-4" /> Create category
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </GlassCard>
  );
}

export function VehicleCategories() {
  const { data: categories = [] } = useVehicleCategories();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Vehicle Categories</h1>
          <p className="mt-1 text-muted">
            The top-level categories (Hatchback, SUV, ...) that pricing and plans are based on.
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New category
          </Button>
        )}
      </div>

      {adding && <NewCategoryForm onClose={() => setAdding(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <CategoryCard key={c.id} category={c} />
        ))}
        {categories.length === 0 && (
          <GlassCard className="flex items-center gap-2 py-12 text-center text-muted sm:col-span-2 lg:col-span-4">
            <Layers className="size-4" /> No categories yet — create one above.
          </GlassCard>
        )}
      </div>
    </div>
  );
}
