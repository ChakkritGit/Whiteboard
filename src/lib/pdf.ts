'use client'

/**
 * A one-page PDF around one JPEG.
 *
 * Written by hand rather than with a library. Every PDF toolkit is several
 * hundred kilobytes of font handling, vector paths and text layout, and none of
 * that is needed to put a single picture on a single page — PDF can carry a
 * JPEG's bytes exactly as they are, with `DCTDecode`, so the whole file is a
 * handful of objects around the image the canvas already produced.
 *
 * The one fiddly part is the cross-reference table: it is a list of byte offsets
 * into the file, so the objects have to be assembled as bytes and measured as
 * they go, not concatenated as a string at the end. A JPEG is binary, and any
 * pass through a JavaScript string would corrupt it.
 */

const encoder = new TextEncoder()

function bytes(text: string) {
  return encoder.encode(text)
}

/**
 * `pointsPerPixel` sizes the page: CSS pixels are 96 to the inch and PDF points
 * are 72, so three quarters keeps a board printed at the size it was drawn.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  width: number,
  height: number,
  pointsPerPixel = 0.75,
): Blob {
  const pageWidth = +(width * pointsPerPixel).toFixed(2)
  const pageHeight = +(height * pointsPerPixel).toFixed(2)

  const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q\n`

  const objects: Uint8Array[] = [
    bytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    bytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    bytes(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    ),
    // The image object is the only one that is not text, so it is built in three
    // pieces with the JPEG dropped in whole.
    concat(
      bytes(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      bytes('\nendstream\nendobj\n'),
    ),
    bytes(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`),
  ]

  const header = bytes('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')
  const offsets: number[] = []
  let cursor = header.length

  for (const object of objects) {
    offsets.push(cursor)
    cursor += object.length
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`

  return new Blob([concat(header, ...objects, bytes(xref))], { type: 'application/pdf' })
}

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
