package com.example.jobmatching.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Extracts plain text from an uploaded PDF using Apache PDFBox.
 *
 * <p>This service is intentionally thin: its only job is to turn raw bytes
 * into a UTF-8 string. The downstream extractor services
 * ({@link CvExtractorService} and {@link JobExtractorService}) pass that
 * string to an LLM to produce structured JSON.
 *
 * <h3>Edge cases to be aware of</h3>
 * <ul>
 *   <li><b>Multi-column layouts</b> — PDFBox reads text left-to-right across
 *       the full page width, which can interleave columns. Consider
 *       {@code PDFTextStripper#setSortByPosition(true)} if you see this.</li>
 *   <li><b>Scanned/image PDFs</b> — PDFBox cannot extract text from image-only
 *       PDFs. The returned string will be blank or whitespace. The caller should
 *       check for this and surface a warning in the review form.</li>
 *   <li><b>Heavily styled CVs</b> — graphic-heavy templates (sidebars, icons,
 *       coloured blocks) often produce garbled extraction order. The review form
 *       is the safety net here: users can correct fields manually.</li>
 * </ul>
 */
@Service
public class PdfParserService {

    /**
     * Extracts all readable text from the given PDF file.
     *
     * @param file the uploaded PDF (must not be null)
     * @return the full extracted text as a UTF-8 string; may be blank for
     *         image-only PDFs
     * @throws IOException if the file cannot be read or is not a valid PDF
     */
    public String extractText(MultipartFile file) throws IOException {
        // PDFBox 3.x uses Loader.loadPDF() instead of the deprecated PDDocument.load()
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();

            // Sort by position improves extraction quality for multi-column layouts
            stripper.setSortByPosition(true);

            String text = stripper.getText(document);

            if (text == null || text.isBlank()) {
                throw new IOException(
                    "No readable text found in the uploaded PDF. "
                    + "This may be a scanned or image-only file. "
                    + "Please use a PDF exported from a word processor, "
                    + "or fill the form manually."
                );
            }

            return text.strip();
        }
    }
}
