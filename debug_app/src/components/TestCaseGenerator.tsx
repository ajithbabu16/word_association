import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface TestCase {
  slNo: number;
  testDescription: string;
  testSteps: string[];
  expectedResults: string;
  status: string;
}

export function TestCaseGenerator({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!apiKey) {
      setError('Please provide a Gemini API Key.');
      return;
    }
    if (!file) {
      setError('Please upload a PDF or PPTX file.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Read file as base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 part
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Init Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      // Let's use gemini-1.5-pro as it's universally available on the API, or gemini-1.5-flash-latest
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

      let mimeType = file.type;
      if (file.name.endsWith('.pptx')) {
        // Fallback for pptx if mimeType is empty
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      }

      const prompt = `You are a QA engineer. Review the attached presentation slides.
For each main feature or heading described in the slides, generate software test cases.
Return ONLY a valid JSON array of objects.
Each object must have these exactly keys:
- slNo (number)
- testDescription (string, MUST start with the word 'Verify')
- testSteps (array of strings, written point-wise)
- expectedResults (string)
- status (string, always set to 'Draft')

Do not include markdown blocks like \`\`\`json. Just the raw JSON array.`;

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType === '' ? 'application/pdf' : mimeType,
          },
        },
        prompt,
      ]);

      const responseText = result.response.text();
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
      if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
      if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

      const parsedJson = JSON.parse(cleanedText) as TestCase[];
      setTestCases(parsedJson);

    } catch (err: any) {
      console.error(err);
      setError('Failed to generate Qubits: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadExcel = () => {
    if (testCases.length === 0) return;

    // Flatten test steps array for Excel
    const dataForExcel = testCases.map(tc => ({
      'SL No.': tc.slNo,
      'Test Description': tc.testDescription,
      'Test Steps': tc.testSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
      'Expected Results': tc.expectedResults,
      'Status': tc.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Qubits');
    XLSX.writeFile(workbook, 'Generated_Qubits.xlsx');
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px',
        width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto',
        color: 'white', display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Qubit Gen Automation from Slides</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label>Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="AIzaSy..." 
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#334155', color: 'white' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <label>Upload Slide (PDF/PPTX)</label>
            <input 
              type="file" 
              accept=".pdf,.pptx" 
              onChange={handleFileChange}
              style={{ padding: '8px' }}
            />
          </div>
          <button 
            onClick={processFile} 
            disabled={isProcessing}
            style={{ 
              marginTop: '20px', padding: '10px 20px', backgroundColor: '#3b82f6', 
              color: 'white', border: 'none', borderRadius: '4px', cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? 'Generating...' : 'Generate Qubits'}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#7f1d1d', color: 'white', padding: '12px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        {testCases.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Generated Qubits ({testCases.length})</h3>
              <button 
                onClick={downloadExcel}
                style={{ backgroundColor: '#10b981', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Download Excel
              </button>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#334155' }}>
                    <th style={{ padding: '12px', border: '1px solid #475569' }}>SL No.</th>
                    <th style={{ padding: '12px', border: '1px solid #475569' }}>Test Description</th>
                    <th style={{ padding: '12px', border: '1px solid #475569' }}>Test Steps</th>
                    <th style={{ padding: '12px', border: '1px solid #475569' }}>Expected Results</th>
                    <th style={{ padding: '12px', border: '1px solid #475569' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((tc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #475569' }}>
                      <td style={{ padding: '12px', border: '1px solid #475569' }}>{tc.slNo}</td>
                      <td style={{ padding: '12px', border: '1px solid #475569' }}>{tc.testDescription}</td>
                      <td style={{ padding: '12px', border: '1px solid #475569', whiteSpace: 'pre-wrap' }}>
                        {tc.testSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #475569' }}>{tc.expectedResults}</td>
                      <td style={{ padding: '12px', border: '1px solid #475569' }}>
                        <span style={{ backgroundColor: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                          {tc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
