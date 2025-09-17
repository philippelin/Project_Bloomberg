
import React, { useState, useEffect, useCallback } from "react";
import { Document } from "@/entities/Document";
import { InvokeLLM } from "@/integrations/Core";
import { Card, CardContent } from "@/../../components/ui/card";
import { Badge } from "@/../../components/ui/badge";
import { Button } from "@/../../components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Target, Eye, EyeOff, RefreshCw, Loader2, FileText } from "lucide-react";

import ThemeSidebar from "../components/analysis/ThemeSidebar";
import DocumentViewer from "../components/analysis/DocumentViewer";
import ThemeDetails from "../components/analysis/ThemeDetails";

export default function AnalyzePage() {
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [highlightedPassages, setHighlightedPassages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get("id");

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

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    const docs = await Document.list();
    const doc = docs.find((d) => String(d.id) === String(documentId));
    if (doc) {
      setDocument({ ...doc, themes: normalizeThemes(doc.themes) });
    }
    setIsLoading(false);
  }, [documentId]);

  useEffect(() => {
    if (documentId) loadDocument();
  }, [documentId, loadDocument]);

  const handleRefreshAnalysis = async () => {
    if (!document?.content) return;
    setIsRefreshing(true);
    setSelectedTheme(null);
    setHighlightedPassages([]);

    const result = await InvokeLLM({
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
${document.content}

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

    const normalized = normalizeThemes(result?.themes || []);
    await Document.update(document.id, { themes: normalized, processing_status: "completed" });
    await loadDocument();
    setIsRefreshing(false);
  };

  const handleThemeSelect = (theme) => {
    setSelectedTheme(theme);
    setHighlightedPassages(theme?.passages || []);
  };

  const clearSelection = () => {
    setSelectedTheme(null);
    setHighlightedPassages([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 text-center">
          <CardContent className="py-8">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Document Not Found</h3>
            <p className="text-slate-500 mb-4">The requested document could not be loaded.</p>
            <Button variant="outline" onClick={() => navigate(createPageUrl("Documents"))}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Documents"))} className="hover:bg-slate-100">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 truncate">{document.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{document.themes?.length || 0} main themes</Badge>
                {selectedTheme && (
                  <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Target className="w-3 h-3 mr-1" />
                    {selectedTheme.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefreshAnalysis} disabled={isRefreshing} title="Refresh AI Analysis">
              {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            {selectedTheme && (
              <Button variant="outline" size="sm" onClick={clearSelection} className="text-slate-600">
                Clear Selection
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden">
              {showSidebar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex h-[calc(100vh-80px)]">
        <div className={`${showSidebar ? "block" : "hidden"} lg:block w-80 border-r border-slate-200/60 bg-white/60 backdrop-blur-sm`}>
          <ThemeSidebar
            themes={document.themes || []}
            selectedTheme={selectedTheme}
            onThemeSelect={handleThemeSelect}
            document={document}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <DocumentViewer document={document} highlightedPassages={highlightedPassages} selectedTheme={selectedTheme} />
          </div>
          {selectedTheme && (
            <div className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm">
              <ThemeDetails theme={selectedTheme} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
