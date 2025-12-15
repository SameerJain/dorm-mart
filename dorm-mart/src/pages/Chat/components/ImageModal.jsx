import React, { useEffect, useRef, useState, useCallback } from "react";
import { useModal } from "../../../hooks/useModal";

export default function ImageModal({
  open,
  onClose,
  onSelect,
  title = "Add image",
}) {
  const closeBtnRef   = useRef(null);
  const fileInputRef  = useRef(null);
  const { isOpen: isModalOpen, open: openModal, close: closeModal } = useModal(open);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync modal state with open prop
  useEffect(() => {
    if (open) {
      openModal();
    } else {
      closeModal();
    }
  }, [open, openModal, closeModal]);

  // Limits & allow-list
  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

  const resetPicker = useCallback(() => {
    setFile(null);
    setErrorMsg(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    resetPicker();
    onClose?.();
  }, [resetPicker, onClose]);


  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!isModalOpen) return null;

  function openPicker() {
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  }

  function isAllowedType(f) {
    // Prefer MIME, but fall back to extension if needed
    if (f.type && ALLOWED_MIME.has(f.type)) return true;

    const name = (f.name || "").toLowerCase();
    const ext = ALLOWED_EXTS.has(
      name.slice(name.lastIndexOf(".")) // includes dot
    );
    return ext;
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    // Size
    if (f.size > MAX_BYTES) {
      setErrorMsg("Image is too large. Max size is 2 MB.");
      setFile(null);
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      return;
    }

    // Type
    if (!isAllowedType(f)) {
      setErrorMsg("Only JPG/JPEG, PNG, and WEBP images are allowed.");
      setFile(null);
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
      return;
    }

    // Valid
    setErrorMsg(null);
    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  function confirm() {
    if (!file || errorMsg) return;
    onSelect?.(file);
    handleClose();
  }

  const labelledBy = "image-modal-title";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 p-4 flex items-center justify-center"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 id={labelledBy} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            ref={closeBtnRef}
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="h-56 sm:h-72 max-h-[65vh] rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900/30">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">No image selected</span>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 dark:text-red-400" aria-live="polite">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Upload photo
            </button>

            <button
              type="button"
              onClick={confirm}
              disabled={!file || !!errorMsg}
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Use image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
