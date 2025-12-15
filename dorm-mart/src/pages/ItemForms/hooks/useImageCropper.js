import { useState, useRef, useEffect } from "react";
import { LIMITS } from "../utils/validation";

/**
 * Hook to manage image cropper state and logic
 */
export function useImageCropper(images, setImages, setErrors, errors) {
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropImgEl, setCropImgEl] = useState(null);
  const [pendingFileName, setPendingFileName] = useState("");
  
  const cropContainerRef = useRef(null);
  const cropCanvasRef = useRef(null);
  
  // Responsive preview box size - smaller on mobile
  const [previewBoxSize, setPreviewBoxSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      return isMobile ? Math.min(480, window.innerWidth - 80) : 480;
    }
    return 480;
  });

  // Update preview box size on window resize
  useEffect(() => {
    const updatePreviewSize = () => {
      const isMobile = window.innerWidth < 768;
      setPreviewBoxSize(isMobile ? Math.min(480, window.innerWidth - 80) : 480);
    };
    window.addEventListener('resize', updatePreviewSize);
    return () => window.removeEventListener('resize', updatePreviewSize);
  }, []);

  const displayInfoRef = useRef({
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
    scale: 1,
  });

  const [selection, setSelection] = useState({
    x: 0,
    y: 0,
    size: 200,
  });

  const selectionRef = useRef({
    x: 0,
    y: 0,
    size: 200,
  });

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef({ x: 0, y: 0 });

  function handlePreviewImgLoaded() {
    const img = cropImgEl;
    const container = cropContainerRef.current;
    if (!img || !container) return;

    const containerSize = previewBoxSize;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    const scale = Math.min(containerSize / imgW, containerSize / imgH);
    const displayW = imgW * scale;
    const displayH = imgH * scale;
    const dx = (containerSize - displayW) / 2;
    const dy = (containerSize - displayH) / 2;

    displayInfoRef.current = { dx, dy, dw: displayW, dh: displayH, scale };

    const selSize = Math.min(200, displayW * 0.8, displayH * 0.8);
    const selX = dx + (displayW - selSize) / 2;
    const selY = dy + (displayH - selSize) / 2;

    const newSel = { x: selX, y: selY, size: selSize };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  function startDrag(e) {
    e.preventDefault();
    draggingRef.current = true;
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    dragStartRef.current = { x: clientX, y: clientY };
    selectionStartRef.current = {
      x: selectionRef.current.x,
      y: selectionRef.current.y,
    };
  }

  function onCropMouseMove(e) {
    if (!draggingRef.current) return;

    const di = displayInfoRef.current;
    const selStart = selectionStartRef.current;
    const dragStart = dragStartRef.current;
    const size = selectionRef.current.size;

    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);

    let newX = selStart.x + (clientX - dragStart.x);
    let newY = selStart.y + (clientY - dragStart.y);

    const minX = di.dx;
    const minY = di.dy;
    const maxX = di.dx + di.dw - size;
    const maxY = di.dy + di.dh - size;

    if (newX < minX) newX = minX;
    if (newY < minY) newY = minY;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    const newSel = { ...selectionRef.current, x: newX, y: newY };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  function onCropMouseUp(e) {
    if (e) {
      e.preventDefault();
    }
    draggingRef.current = false;
  }

  function handleCropConfirm() {
    if (!cropImgEl || !cropImageSrc) {
      setShowCropper(false);
      return;
    }

    if (images.length >= LIMITS.images) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${LIMITS.images} images allowed.`,
      }));
      setShowCropper(false);
      setCropImageSrc(null);
      setCropImgEl(null);
      setPendingFileName("");
      return;
    }

    const di = displayInfoRef.current;
    const sel = selectionRef.current;

    const selXInImg = (sel.x - di.dx) / di.scale;
    const selYInImg = (sel.y - di.dy) / di.scale;
    const selSizeInImg = sel.size / di.scale;

    const canvasSize = 360;
    const canvas = cropCanvasRef.current;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    ctx.drawImage(
      cropImgEl,
      selXInImg,
      selYInImg,
      selSizeInImg,
      selSizeInImg,
      0,
      0,
      canvasSize,
      canvasSize
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setShowCropper(false);
          return;
        }
        
        if (images.length >= LIMITS.images) {
          setErrors((prev) => ({
            ...prev,
            images: `Maximum ${LIMITS.images} images allowed.`,
          }));
          setShowCropper(false);
          setCropImageSrc(null);
          setCropImgEl(null);
          setPendingFileName("");
          return;
        }

        const finalFile = new File([blob], pendingFileName, {
          type: "image/png",
        });
        const finalUrl = URL.createObjectURL(blob);

        setImages((prev) => [...prev, { file: finalFile, url: finalUrl }]);

        if (errors.images) {
          setErrors((prev) => {
            const ne = { ...prev };
            delete ne.images;
            return ne;
          });
        }

        setShowCropper(false);
        setCropImageSrc(null);
        setCropImgEl(null);
        setPendingFileName("");
      },
      "image/png",
      1
    );
  }

  function handleCropCancel() {
    setShowCropper(false);
    setCropImageSrc(null);
    setCropImgEl(null);
    setPendingFileName("");
  }

  return {
    showCropper,
    setShowCropper,
    cropImageSrc,
    setCropImageSrc,
    cropImgEl,
    setCropImgEl,
    pendingFileName,
    setPendingFileName,
    previewBoxSize,
    cropContainerRef,
    cropCanvasRef,
    selection,
    startDrag,
    onCropMouseMove,
    onCropMouseUp,
    handleCropConfirm,
    handleCropCancel,
    handlePreviewImgLoaded,
  };
}



