import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BrushStroke, CanvasSession } from '../../types';
import { supabaseHelpers, TABLES } from '../../services/supabase';

// Define the initial state
interface CanvasState {
  currentSession: CanvasSession | null;
  strokes: BrushStroke[];
  currentTool: 'brush' | 'eraser' | 'magnifier';
  brushColor: string;
  brushSize: number;
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  undoStack: BrushStroke[][];
  redoStack: BrushStroke[][];
  isDrawing: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: CanvasState = {
  currentSession: null,
  strokes: [],
  currentTool: 'brush',
  brushColor: '#FF0000',
  brushSize: 15,
  canvasScale: 1,
  canvasOffset: { x: 0, y: 0 },
  undoStack: [],
  redoStack: [],
  isDrawing: false,
  isLoading: false,
  error: null,
};

// Async thunks for canvas operations
export const createCanvasSession = createAsyncThunk(
  'canvas/createSession',
  async ({ imageId, userId }: { imageId: string; userId?: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { canvas: CanvasState; auth: { user: { id: string } | null } };
      const ownerId = userId || state.auth.user?.id;
      if (!ownerId) {
        throw new Error('Missing user session');
      }
      const sessionData = {
        strokes: state.canvas.strokes,
        current_tool: state.canvas.currentTool,
        brush_color: state.canvas.brushColor,
        brush_size: state.canvas.brushSize,
        canvas_scale: state.canvas.canvasScale,
        canvas_offset: state.canvas.canvasOffset,
      };

      const session = await supabaseHelpers.insertRecord(TABLES.CANVAS_SESSIONS, {
        image_id: imageId,
        user_id: ownerId,
        session_data: sessionData,
        current_step: 0,
      });

      return session as CanvasSession;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create canvas session');
    }
  }
);

export const saveCanvasSession = createAsyncThunk(
  'canvas/saveSession',
  async (sessionId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { canvas: CanvasState };
      const sessionData = {
        strokes: state.canvas.strokes,
        current_tool: state.canvas.currentTool,
        brush_color: state.canvas.brushColor,
        brush_size: state.canvas.brushSize,
        canvas_scale: state.canvas.canvasScale,
        canvas_offset: state.canvas.canvasOffset,
      };

      const updatedSession = await supabaseHelpers.updateRecord(TABLES.CANVAS_SESSIONS, sessionId, {
        session_data: sessionData,
        current_step: state.canvas.undoStack.length,
      });

      return updatedSession as CanvasSession;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save canvas session');
    }
  }
);

export const loadCanvasSession = createAsyncThunk(
  'canvas/loadSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const session = await supabaseHelpers.getRecord(TABLES.CANVAS_SESSIONS, sessionId);
      return session as CanvasSession;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load canvas session');
    }
  }
);

// Create the canvas slice
const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    // Tool and brush settings
    setCurrentTool: (state, action: PayloadAction<'brush' | 'eraser' | 'magnifier'>) => {
      state.currentTool = action.payload;
    },
    setBrushColor: (state, action: PayloadAction<string>) => {
      state.brushColor = action.payload;
    },
    setBrushSize: (state, action: PayloadAction<number>) => {
      state.brushSize = action.payload;
    },
    
    // Canvas transform
    setCanvasScale: (state, action: PayloadAction<number>) => {
      state.canvasScale = action.payload;
    },
    setCanvasOffset: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.canvasOffset = action.payload;
    },
    
    // Drawing state
    setIsDrawing: (state, action: PayloadAction<boolean>) => {
      state.isDrawing = action.payload;
    },
    
    // Stroke management
    addStroke: (state, action: PayloadAction<BrushStroke>) => {
      // Save current state to undo stack before adding new stroke
      state.undoStack.push([...state.strokes]);
      state.strokes.push(action.payload);
      // Clear redo stack when new action is performed
      state.redoStack = [];
      // Limit undo stack size
      if (state.undoStack.length > 50) {
        state.undoStack.shift();
      }
    },
    
    updateLastStroke: (state, action: PayloadAction<Partial<BrushStroke>>) => {
      if (state.strokes.length > 0) {
        const lastIndex = state.strokes.length - 1;
        state.strokes[lastIndex] = { ...state.strokes[lastIndex], ...action.payload };
      }
    },
    
    // Undo/Redo operations
    undo: (state) => {
      if (state.undoStack.length > 0) {
        // Save current state to redo stack
        state.redoStack.push([...state.strokes]);
        // Restore previous state
        const previousState = state.undoStack.pop();
        if (previousState) {
          state.strokes = previousState;
        }
        // Limit redo stack size
        if (state.redoStack.length > 50) {
          state.redoStack.shift();
        }
      }
    },
    
    redo: (state) => {
      if (state.redoStack.length > 0) {
        // Save current state to undo stack
        state.undoStack.push([...state.strokes]);
        // Restore next state
        const nextState = state.redoStack.pop();
        if (nextState) {
          state.strokes = nextState;
        }
      }
    },
    
    // Clear operations
    clearCanvas: (state) => {
      // Save current state to undo stack
      state.undoStack.push([...state.strokes]);
      state.strokes = [];
      state.redoStack = [];
    },
    
    clearHistory: (state) => {
      state.undoStack = [];
      state.redoStack = [];
    },
    
    // Reset canvas to initial state
    resetCanvas: (state) => {
      state.strokes = [];
      state.undoStack = [];
      state.redoStack = [];
      state.currentTool = 'brush';
      state.brushColor = '#FF0000';
      state.brushSize = 15;
      state.canvasScale = 1;
      state.canvasOffset = { x: 0, y: 0 };
      state.isDrawing = false;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Create Canvas Session
    builder
      .addCase(createCanvasSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCanvasSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSession = action.payload;
        state.error = null;
      })
      .addCase(createCanvasSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Save Canvas Session
      .addCase(saveCanvasSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(saveCanvasSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSession = action.payload;
        state.error = null;
      })
      .addCase(saveCanvasSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Load Canvas Session
      .addCase(loadCanvasSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadCanvasSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSession = action.payload;
        
        // Restore canvas state from session data
        // Note: CanvasSession doesn't have session_data property, using brush_strokes directly
        state.strokes = action.payload.brush_strokes || [];
        // Set default values for canvas state (these would need to be stored separately or have defaults)
        state.currentTool = 'brush';
        state.brushColor = '#FF0000';
        state.brushSize = 15;
        state.canvasScale = 1;
        state.canvasOffset = { x: 0, y: 0 };
        
        state.error = null;
      })
      .addCase(loadCanvasSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const {
  setCurrentTool,
  setBrushColor,
  setBrushSize,
  setCanvasScale,
  setCanvasOffset,
  setIsDrawing,
  addStroke,
  updateLastStroke,
  undo,
  redo,
  clearCanvas,
  clearHistory,
  resetCanvas,
  clearError,
} = canvasSlice.actions;

// Export reducer
export default canvasSlice.reducer;

// Selectors
export const selectCanvas = (state: { canvas: CanvasState }) => state.canvas;
export const selectStrokes = (state: { canvas: CanvasState }) => state.canvas.strokes;
export const selectCurrentTool = (state: { canvas: CanvasState }) => state.canvas.currentTool;
export const selectBrushSettings = (state: { canvas: CanvasState }) => ({
  color: state.canvas.brushColor,
  size: state.canvas.brushSize,
});
export const selectCanvasTransform = (state: { canvas: CanvasState }) => ({
  scale: state.canvas.canvasScale,
  offset: state.canvas.canvasOffset,
});
export const selectCanUndo = (state: { canvas: CanvasState }) => state.canvas.undoStack.length > 0;
export const selectCanRedo = (state: { canvas: CanvasState }) => state.canvas.redoStack.length > 0;
export const selectIsDrawing = (state: { canvas: CanvasState }) => state.canvas.isDrawing;
export const selectCanvasLoading = (state: { canvas: CanvasState }) => state.canvas.isLoading;
export const selectCanvasError = (state: { canvas: CanvasState }) => state.canvas.error;
