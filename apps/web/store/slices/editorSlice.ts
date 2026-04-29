'use client';

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type EditorTool = 'push' | 'restore';

interface EditorState {
  originalImageDataUrl: string | null;
  sourceImageDataUrl: string | null;
  outputImageDataUrl: string | null;
  tool: EditorTool;
  brushSize: number;
  generating: boolean;
  error: string | null;
}

const initialState: EditorState = {
  originalImageDataUrl: null,
  sourceImageDataUrl: null,
  outputImageDataUrl: null,
  tool: 'push',
  brushSize: 45,
  generating: false,
  error: null,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setOriginalImageDataUrl: (state, action: PayloadAction<string | null>) => {
      state.originalImageDataUrl = action.payload;
    },
    setSourceImageDataUrl: (state, action: PayloadAction<string | null>) => {
      state.sourceImageDataUrl = action.payload;
      if (action.payload) {
        state.outputImageDataUrl = action.payload;
      }
    },
    setOutputImageDataUrl: (state, action: PayloadAction<string | null>) => {
      state.outputImageDataUrl = action.payload;
    },
    setEditorTool: (state, action: PayloadAction<EditorTool>) => {
      state.tool = action.payload;
    },
    setBrushSize: (state, action: PayloadAction<number>) => {
      state.brushSize = action.payload;
    },
    setEditorGenerating: (state, action: PayloadAction<boolean>) => {
      state.generating = action.payload;
    },
    setEditorError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setOriginalImageDataUrl,
  setSourceImageDataUrl,
  setOutputImageDataUrl,
  setEditorTool,
  setBrushSize,
  setEditorGenerating,
  setEditorError,
} = editorSlice.actions;

export const selectEditorState = (state: { editor: EditorState }) => state.editor;

export default editorSlice.reducer;
