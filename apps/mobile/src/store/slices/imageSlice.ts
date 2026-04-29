import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ImageData, AIEdit, User } from '../../types';
import { supabaseHelpers, TABLES, BUCKETS } from '../../services/supabase';

// Define the initial state
interface ImageState {
  images: ImageData[];
  currentImage: ImageData | null;
  aiEdits: AIEdit[];
  isUploading: boolean;
  isProcessing: boolean;
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
}

const initialState: ImageState = {
  images: [],
  currentImage: null,
  aiEdits: [],
  isUploading: false,
  isProcessing: false,
  isLoading: false,
  uploadProgress: 0,
  error: null,
};

// Async thunks for image operations
export const uploadImage = createAsyncThunk(
  'image/upload',
  async (
    { uri, userId, fileName }: { uri: string; userId?: string; fileName?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { auth: { user: User | null } };
      const ownerId = userId || state.auth.user?.id;
      if (!ownerId) {
        throw new Error('Missing user session');
      }
      // Create a unique filename if not provided
      const finalFileName = fileName || `image_${Date.now()}.jpg`;
      
      // Upload image to Supabase storage
      const { data: uploadData, error: uploadError } = await supabaseHelpers.supabase.storage
        .from(BUCKETS.IMAGES)
        .upload(`${ownerId}/${finalFileName}`, {
          uri,
          type: 'image/jpeg',
          name: finalFileName,
        } as any);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabaseHelpers.supabase.storage
        .from(BUCKETS.IMAGES)
        .getPublicUrl(uploadData.path);

      // Save image metadata to database
      const imageRecord = await supabaseHelpers.insertRecord(TABLES.IMAGES, {
        user_id: ownerId,
        original_url: urlData.publicUrl,
        file_name: finalFileName,
        file_size: 0, // Will be updated if we can get file size
        upload_date: new Date().toISOString(),
        is_processed: false,
      });

      return imageRecord as ImageData;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to upload image');
    }
  }
);

export const getUserImages = createAsyncThunk(
  'image/getUserImages',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabaseHelpers.supabase
        .from(TABLES.IMAGES)
        .select('*')
        .eq('user_id', userId)
        .order('upload_date', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as ImageData[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch user images');
    }
  }
);

export const getImageAIEdits = createAsyncThunk(
  'image/getAIEdits',
  async (imageId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabaseHelpers.supabase
        .from(TABLES.AI_EDITS)
        .select('*')
        .eq('image_id', imageId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as AIEdit[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch AI edits');
    }
  }
);

export const deleteImage = createAsyncThunk(
  'image/delete',
  async (imageId: string, { rejectWithValue }) => {
    try {
      // Get image data to get file path
      const imageData = await supabaseHelpers.getRecord(TABLES.IMAGES, imageId) as ImageData;
      
      if (imageData) {
        // Extract file path from URL
        const urlParts = imageData.original_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const userId = imageData.user_id || 'anonymous';
        const filePath = `${userId}/${fileName}`;

        // Delete from storage
        await supabaseHelpers.supabase.storage
          .from(BUCKETS.IMAGES)
          .remove([filePath]);
      }

      // Delete from database
      await supabaseHelpers.deleteRecord(TABLES.IMAGES, imageId);

      return imageId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete image');
    }
  }
);

// Create the image slice
const imageSlice = createSlice({
  name: 'image',
  initialState,
  reducers: {
    // Set current image
    setCurrentImage: (state, action: PayloadAction<ImageData | null>) => {
      state.currentImage = action.payload;
    },
    
    // Update upload progress
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    
    // Clear images
    clearImages: (state) => {
      state.images = [];
      state.currentImage = null;
    },
    
    // Clear AI edits
    clearAIEdits: (state) => {
      state.aiEdits = [];
    },
    
    // Update image in list
    updateImageInList: (state, action: PayloadAction<ImageData>) => {
      const index = state.images.findIndex(img => img.id === action.payload.id);
      if (index !== -1) {
        state.images[index] = action.payload;
      }
      
      // Update current image if it's the same
      if (state.currentImage?.id === action.payload.id) {
        state.currentImage = action.payload;
      }
    },
    
    // Remove image from list
    removeImageFromList: (state, action: PayloadAction<string>) => {
      state.images = state.images.filter(img => img.id !== action.payload);
      
      // Clear current image if it's the deleted one
      if (state.currentImage?.id === action.payload) {
        state.currentImage = null;
      }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Reset upload progress
    resetUploadProgress: (state) => {
      state.uploadProgress = 0;
    },
  },
  extraReducers: (builder) => {
    // Upload Image
    builder
      .addCase(uploadImage.pending, (state) => {
        state.isUploading = true;
        state.error = null;
        state.uploadProgress = 0;
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        state.isUploading = false;
        state.images.unshift(action.payload); // Add to beginning of array
        state.currentImage = action.payload;
        state.uploadProgress = 100;
        state.error = null;
      })
      .addCase(uploadImage.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload as string;
        state.uploadProgress = 0;
      })
      // Get User Images
      .addCase(getUserImages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserImages.fulfilled, (state, action) => {
        state.isLoading = false;
        state.images = action.payload;
        state.error = null;
      })
      .addCase(getUserImages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Get Image AI Edits
      .addCase(getImageAIEdits.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getImageAIEdits.fulfilled, (state, action) => {
        state.isLoading = false;
        state.aiEdits = action.payload;
        state.error = null;
      })
      .addCase(getImageAIEdits.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete Image
      .addCase(deleteImage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteImage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.images = state.images.filter(img => img.id !== action.payload);
        
        // Clear current image if it's the deleted one
        if (state.currentImage?.id === action.payload) {
          state.currentImage = null;
        }
        
        state.error = null;
      })
      .addCase(deleteImage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const {
  setCurrentImage,
  setUploadProgress,
  clearImages,
  clearAIEdits,
  updateImageInList,
  removeImageFromList,
  clearError,
  resetUploadProgress,
} = imageSlice.actions;

// Export reducer
export default imageSlice.reducer;

// Selectors
export const selectImages = (state: { image: ImageState }) => state.image.images;
export const selectCurrentImage = (state: { image: ImageState }) => state.image.currentImage;
export const selectAIEdits = (state: { image: ImageState }) => state.image.aiEdits;
export const selectIsUploading = (state: { image: ImageState }) => state.image.isUploading;
export const selectIsProcessing = (state: { image: ImageState }) => state.image.isProcessing;
export const selectIsLoading = (state: { image: ImageState }) => state.image.isLoading;
export const selectUploadProgress = (state: { image: ImageState }) => state.image.uploadProgress;
export const selectImageError = (state: { image: ImageState }) => state.image.error;
