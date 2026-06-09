import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAdmin } from '@/lib/auth';

const PROMPT = `You are an OCR assistant for an Indian textile factory ERP.
Analyze this purchase/delivery challan/invoice image and extract:
1. supplier_name: Supplier/Party name
2. supplier_gstin: GSTIN number (format: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter + 1 digit, e.g. 24AABCP1234A1Z5)
3. invoice_no: Invoice or challan number
4. invoice_date: Date in YYYY-MM-DD format
5. items: Array of line items, each with:
   - description: Item description
   - quantity: Numeric quantity
   - unit: Unit (kg, bags, cones, etc.)
   - rate: Rate per unit (number)
   - amount: Total amount for this line (number)
   - hsn_code: HSN code if visible
6. total_amount: Grand total amount
7. tax_amount: Total tax/GST amount if visible (or null)
8. vehicle_no: Vehicle number if visible (or null)
9. notes: Any additional notes

Return ONLY valid JSON, no markdown, no explanation. Example:
{"supplier_name":"...","supplier_gstin":"...","invoice_no":"...","invoice_date":"2026-01-15","items":[{"description":"Cotton Yarn","quantity":100,"unit":"kg","rate":45,"amount":4500,"hsn_code":"5106"}],"total_amount":4500,"tax_amount":null,"vehicle_no":null,"notes":null}`;

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);

    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GOOGLE_GENAI_API_KEY not set in environment' }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG, or WEBP.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      { inlineData: { mimeType: file.type as any, data: base64 } },
      PROMPT,
    ]);

    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();

    let extracted: any;
    try {
      extracted = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'Gemini returned non-JSON response', raw: text }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (e: any) {
    const status = e.message?.includes('required') ? 403 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
