/** Export SVG city scene to PNG without extra dependencies. */
export async function exportCityPng(
  svgEl: SVGSVGElement,
  filename: string
): Promise<void> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const bbox = svgEl.getBoundingClientRect();
  const width = Math.max(1, Math.round(bbox.width));
  const height = Math.max(1, Math.round(bbox.height));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("PNG export failed"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas unavailable");
  }
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  const pngUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = filename;
  a.click();
}
