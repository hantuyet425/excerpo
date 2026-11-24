// Shared by the background worker and the export tests.
function buildBookText(chapters) {
  return chapters.map(c => `${c.chapter_title}\n\n${c.content}`).join('\n\n\n');
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'\"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;'
  })[c]);
}

async function buildEpubBuffer(book, chapters) {
  const zip = new JSZip();
  const title = escapeXml(book.bookName || 'Book');
  const id = `excerpo-${book.id}`;
  // EPUB requires the first ZIP entry to be an uncompressed mimetype.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  const manifest = [];
  const spine = [];
  const nav = [];
  chapters.forEach((chapter, i) => {
    const name = `chapter-${i + 1}`;
    const chapterTitle = escapeXml(chapter.chapter_title);
    manifest.push(`<item id="${name}" href="${name}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${name}"/>`);
    nav.push(`<navPoint id="${name}" playOrder="${i + 1}"><navLabel><text>${chapterTitle}</text></navLabel><content src="${name}.xhtml"/></navPoint>`);
    const paragraphs = chapter.content.split(/\r?\n\s*\r?\n/)
      .map(p => `<p>${escapeXml(p).replace(/\r?\n/g, '<br/>')}</p>`).join('\n');
    zip.file(`OEBPS/${name}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${chapterTitle}</title></head>
<body><h1>${chapterTitle}</h1>${paragraphs}</body></html>`);
  });

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${title}</dc:title><dc:language>und</dc:language><dc:identifier id="BookID">${escapeXml(id)}</dc:identifier>
    <dc:creator>${escapeXml(book.authorName || 'Unknown')}</dc:creator>
  </metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifest.join('')}</manifest>
  <spine toc="ncx">${spine.join('')}</spine>
</package>`);
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapeXml(id)}"/><meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
  <docTitle><text>${title}</text></docTitle><navMap>${nav.join('')}</navMap>
</ncx>`);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
