import OpenAI from 'openai';
import { z } from 'zod';
import type { OCRResult } from '../../types';
import { config } from '../../config';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Validation schema for OCR response
const OCRResponseSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  currency: z.string().nullable(),
  amount: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

export class ReceiptOCRService {
  private static readonly SYSTEM_PROMPT = `
You are a receipt OCR system. Analyze the receipt image and extract the following information in JSON format:

{
  "merchant": "string | null",
  "date": "dd.mm.yyyy | null", 
  "currency": "EUR | null",
  "amount": "number | null",
  "confidence": "number between 0 and 1"
}

Instructions:
- Extract the total amount paid (not individual line items)
- Date should be in dd.mm.yyyy format
- Currency should be EUR only
- Confidence should reflect how certain you are about the extracted data (1.0 = very confident, 0.0 = not confident)
- If any field cannot be determined, set it to null
- Return ONLY valid JSON, no additional text or formatting

Common receipt patterns to look for:
- Total, Amount Due, Balance Due, Grand Total
- Date formats: DD/MM/YYYY, dd.mm.yyyy, MM/DD/YYYY (convert all to dd.mm.yyyy)
- All currency symbols will be converted to EUR
- Merchant name is usually at the top of the receipt
  `;

  static async extractReceiptData(receiptUrl: string): Promise<OCRResult> {
    try {
      console.log(`Starting OCR extraction for: ${receiptUrl}`);

      const response = await openai.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: this.SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract the receipt information from this image:',
              },
              {
                type: 'image_url',
                image_url: {
                  url: receiptUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        console.warn('Empty response from OpenAI');
        return this.createFailureResult('Empty response from OCR service');
      }

      console.log('Raw OCR response:', content);

      // Parse JSON response - handle markdown code blocks
      let parsedData;
      try {
        // Remove markdown code blocks if present
        const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
        parsedData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse OCR JSON response:', parseError);
        console.error('Raw content:', content);
        return this.createFailureResult('Invalid JSON response from OCR service');
      }

      // Validate the parsed data
      const validationResult = OCRResponseSchema.safeParse(parsedData);
      
      if (!validationResult.success) {
        console.error('OCR response validation failed:', validationResult.error);
        console.error('Parsed data:', parsedData);
        return this.createFailureResult('Invalid OCR response format');
      }

      const ocrResult = validationResult.data;
      
      // Post-process the data
      const processedResult = this.postProcessOCRResult(ocrResult);
      
      console.log('Processed OCR result:', processedResult);
      
      return processedResult;
    } catch (error) {
      console.error('OCR extraction error:', error);
      
      if (error instanceof Error) {
        // Handle specific OpenAI errors
        if (error.message.includes('invalid_image')) {
          return this.createFailureResult('Invalid or corrupted image');
        }
        if (error.message.includes('rate_limit')) {
          return this.createFailureResult('OCR service rate limit exceeded');
        }
        if (error.message.includes('insufficient_quota')) {
          return this.createFailureResult('OCR service quota exceeded');
        }
      }
      
      return this.createFailureResult('OCR service temporarily unavailable');
    }
  }

  private static postProcessOCRResult(rawResult: any): OCRResult {
    const result: OCRResult = {
      merchant: this.processStringField(rawResult.merchant),
      date: this.processDateField(rawResult.date),
      currency: this.processCurrencyField(rawResult.currency),
      amount: this.processAmountField(rawResult.amount),
      confidence: Math.max(0, Math.min(1, rawResult.confidence || 0)),
    };

    // Adjust confidence based on data quality
    result.confidence = this.calculateAdjustedConfidence(result);

    return result;
  }

  private static processStringField(value: any): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().substring(0, 100); // Limit length
    }
    return null;
  }

  private static processDateField(dateString: any): string | null {
    if (typeof dateString !== 'string' || !dateString.trim()) {
      return null;
    }

    try {
      const date = new Date(dateString.trim());
      
      // Check if date is valid and not too far in the future/past
      const now = new Date();
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(now.getFullYear() - 2);
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(now.getDate() + 7);
      
      if (date >= twoYearsAgo && date <= oneWeekFromNow) {
        // Convert to dd.mm.yyyy format
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }
    } catch (error) {
      console.warn('Invalid date format:', dateString);
    }

    return null;
  }

  private static processCurrencyField(currency: any): string | null {
    if (typeof currency === 'string' && currency.trim().length > 0) {
      const cleanCurrency = currency.trim().toUpperCase();
      
      // Only EUR currency allowed
      const validCurrencies = ['EUR'];

      if (validCurrencies.includes(cleanCurrency)) {
        return cleanCurrency;
      }

      // Handle currency symbols - map all to EUR
      const currencyMap: Record<string, string> = {
        '$': 'EUR',
        '€': 'EUR',
        '£': 'EUR',
        '¥': 'EUR',
        '¢': 'EUR',
      };

      return currencyMap[cleanCurrency] || 'EUR';
    }
    return null;
  }

  private static processAmountField(amount: any): number | null {
    if (typeof amount === 'number' && amount >= 0 && amount <= 100000) {
      return Math.round(amount * 100) / 100; // Round to 2 decimal places
    }
    
    if (typeof amount === 'string') {
      // Try to parse string amounts like "$12.50" or "12,50"
      const cleanAmount = amount.replace(/[^0-9.,]/g, '');
      const numAmount = parseFloat(cleanAmount.replace(',', '.'));
      
      if (!isNaN(numAmount) && numAmount >= 0 && numAmount <= 100000) {
        return Math.round(numAmount * 100) / 100;
      }
    }
    
    return null;
  }

  private static calculateAdjustedConfidence(result: OCRResult): number {
    let confidence = result.confidence;
    
    // Reduce confidence if critical fields are missing
    if (!result.amount) confidence *= 0.5;
    if (!result.merchant) confidence *= 0.8;
    if (!result.date) confidence *= 0.9;
    if (!result.currency) confidence *= 0.9;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private static createFailureResult(reason: string): OCRResult {
    console.error(`OCR extraction failed: ${reason}`);
    return {
      merchant: null,
      date: null,
      currency: null,
      amount: null,
      confidence: 0,
    };
  }

  // Utility method to check if OCR result is usable
  static isOCRResultUsable(result: OCRResult): boolean {
    return result.confidence > 0.3 && result.amount !== null;
  }

  // Method to get confidence level description
  static getConfidenceDescription(confidence: number): string {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    if (confidence >= 0.3) return 'Low';
    return 'Very Low';
  }
}