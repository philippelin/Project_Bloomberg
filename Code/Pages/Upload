
import React, { useState } from "react";
import { Document } from "@/entities/Document";
import { UploadFile, ExtractDataFromUploadedFile, InvokeLLM } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload as UploadIcon, FileText, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState("");

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file only");
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const normalizeThemes = (themes = []) =>
    (themes || [])
      .map((t, idx) => {
        if (!t) return null;
        const subThemes = Array.isArray(t.sub_themes) ? t.sub_themes : [];
        const firstSub = subThemes.find((st) => st?.name && st.name.trim() !== "");
        const theme_name =
          t.theme_name && t.theme_name.trim() !== ""
            ? t.theme_name
            : firstSub?.name || `Financial Theme ${idx + 1}`;
        return { ...t, theme_name, sub_themes: subThemes };
      })
      .filter(Boolean);

  const processDocument = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProgress(10);
    setCurrentStep("Uploading document...");

    // 1) Upload file
    const { file_url } = await UploadFile({ file });
    setProgress(30);
    setCurrentStep("Extracting content by page...");

    // 2) Extract per-page content
    const extractionResult = await ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                page_number: { type: "number" },
                text: { type: "string" },
              },
              required: ["page_number", "text"],
            },
          },
        },
        required: ["pages"],
      },
    });

    if (extractionResult.status !== "success" || !extractionResult.output?.pages) {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep("");
      setError(extractionResult.details || "Failed to extract document content");
      return;
    }

    const pages = extractionResult.output.pages;
    const fullContent = pages.map((p) => `--- Page ${p.page_number} ---\n${p.text}`).join("\n\n");

    setProgress(60);
    setCurrentStep("Analyzing financial themes...");

    // 3) AI themes with strict verbatim extraction
    const themesResult = await InvokeLLM({
      prompt: `You are a financial analyst tasked with finding themes in this document. 

**ABSOLUTE REQUIREMENTS:**
1. **EXTRACT ONLY REAL TEXT**: Every 'text' field MUST be copied EXACTLY from the document below. Do NOT paraphrase, summarize, or modify even a single character.
2. **VERBATIM COPYING**: Copy complete sentences or paragraphs exactly as they appear, including all punctuation, capitalization, and spacing.
3. **FINDABLE TEXT**: The extracted text must be searchable in the original PDF. If you can't find it with Ctrl+F, don't include it.
4. **NO INVENTION**: Do not create, modify, or combine text from different parts. Only extract what actually exists.

**PROCESS:**
- Identify financial themes in the document
- For each theme, find 1-3 specific passages that support it
- Copy those passages EXACTLY as written in the document
- Include the page number where each passage appears

Document content:
${fullContent}

Find real financial themes and extract only real, verbatim passages that can be found in the document.`,
      response_json_schema: {
        type: "object",
        properties: {
          themes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                theme_name: { type: "string" },
                theme_description: { type: "string" },
                sub_themes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      passages: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            page_number: { type: "number" },
                            relevance_score: { type: "number" }
                          },
                          required: ["text", "page_number", "relevance_score"]
                        }
                      }
                    },
                    required: ["id", "name", "passages"]
                  }
                }
              },
              required: ["theme_name", "sub_themes"]
            }
          }
        },
        required: ["themes"]
      }
    });

    const normalized = normalizeThemes(themesResult?.themes || []);

    setProgress(85);
    setCurrentStep("Saving document...");

    // 4) Save record
    const saved = await Document.create({
      title: file.name,
      file_url,
      content: fullContent,
      themes: normalized,
      processing_status: "completed",
    });

    setProgress(100);
    setCurrentStep("Complete!");

    setTimeout(() => navigate(createPageUrl(`Analyze?id=${saved.id}`)), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Documents"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">Upload Financial Document</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Document Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isProcessing ? (
              <>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
                      <UploadIcon className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Choose PDF Document</h3>
                    <p className="text-slate-500 mb-4">Select a financial PDF to analyze</p>
                    <Button variant="outline" className="hover:bg-blue-50">Browse Files</Button>
                    <p className="text-xs text-slate-400 mt-3">PDF only</p>
                  </label>
                </div>

                {file && (
                  <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-slate-700">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button onClick={processDocument} className="bg-blue-600 hover:bg-blue-700">Process Document</Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Processing Document</h3>
                  <p className="text-slate-500">{currentStep}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                {progress === 100 && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Done! Redirecting…</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
