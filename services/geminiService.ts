
import { GoogleGenAI, GenerateContentResponse, Type, Chat } from "@google/genai";
import { Exercise, WorkoutPlan } from '../types';
import * as aiCache from './aiCache';

const API_KEY = process.env.API_KEY;

let genAIInstance: GoogleGenAI | null = null;

function getGenAIInstance(): GoogleGenAI {
    if (!genAIInstance) {
        if (!API_KEY) {
            console.error("API_KEY for Gemini is not set in environment variables. Gemini services will fail.");
            throw new Error("API_KEY for Gemini is not configured. Cannot initialize AI service.");
        }
        genAIInstance = new GoogleGenAI({ apiKey: API_KEY });
    }
    return genAIInstance;
}

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); 
      } else {
        reject(new Error("Failed to read file as data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  try {
    const base64Data = await base64EncodedDataPromise;
    return {
      inlineData: { data: base64Data, mimeType: file.type },
    };
  } catch (error) {
    console.error("Error converting file to base64:", error);
    throw new Error("Could not process file for analysis.");
  }
};

interface ExtractedExerciseData {
  name: string;
  description: string;
  startTime?: number;
  endTime?: number;
  muscleGroups?: string[];
  equipment?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors (client errors)
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('400') || errorMsg.includes('invalid file') || errorMsg.includes('malformed')) {
          throw error; // Don't retry client errors
        }
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export const analyzeVideoAndExtractExercises = async (
  videoFile: File,
  useProModel: boolean,
  videoHash?: string
): Promise<ExtractedExerciseData[]> => {
  // Check cache first if videoHash is provided
  if (videoHash) {
    const modelUsed = useProModel ? 'pro' : 'flash';
    const cached = aiCache.getCachedAnalysis(videoHash, modelUsed);
    if (cached) {
      console.log('Using cached analysis result');
      return cached as ExtractedExerciseData[];
    }
  }

  const ai = getGenAIInstance();

  if (!videoFile.type.startsWith('video/')) {
    throw new Error("Invalid file type. Please upload a video file.");
  }

  const videoPart = await fileToGenerativePart(videoFile);
  
  const textPart = {
    text: useProModel
      ? `
Analyze the provided video in detail to identify all distinct physical exercises being performed.
For each exercise you find, determine:
1. Its specific name
2. A detailed description of the movement including common mistakes to avoid
3. The primary muscle groups targeted (e.g., "Chest", "Triceps", "Shoulders")
4. Equipment needed (e.g., "Barbell", "Dumbbells", "Bodyweight", "Resistance Bands")
5. Difficulty level (Beginner, Intermediate, or Advanced)
6. Start time and end time in seconds
The output must be structured according to the JSON schema provided.
If no exercises are identifiable, return an empty array.`
      : `
Analyze the provided video to identify all distinct physical exercises being performed.
For each exercise you find, determine:
1. Its specific name
2. A brief description of the movement
3. The primary muscle groups targeted
4. Equipment needed
5. Difficulty level
6. Start time and end time in seconds
The output must be structured according to the JSON schema provided.
If no exercises are identifiable, return an empty array.`
  };
  
  const exerciseSchema = {
    type: Type.ARRAY,
    description: "A list of exercises identified in the video.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "The specific name of the exercise (e.g., 'Jumping Jacks', 'Push-up')."
        },
        description: {
          type: Type.STRING,
          description: useProModel
            ? "A detailed description of how the exercise is performed, including common mistakes (max 250 characters)."
            : "A brief description of how the exercise is performed (max 150 characters)."
        },
        muscleGroups: {
          type: Type.ARRAY,
          description: "Primary muscle groups targeted by this exercise",
          items: {
            type: Type.STRING
          }
        },
        equipment: {
          type: Type.STRING,
          description: "Equipment needed for this exercise (e.g., 'Barbell', 'Dumbbells', 'Bodyweight')"
        },
        difficulty: {
          type: Type.STRING,
          description: "Difficulty level: 'Beginner', 'Intermediate', or 'Advanced'"
        },
        startTime: {
          type: Type.NUMBER,
          description: "The precise start time of the exercise in the video, in seconds."
        },
        endTime: {
          type: Type.NUMBER,
          description: "The precise end time of the exercise in the video, in seconds."
        }
      },
      required: ["name", "description", "startTime", "endTime"]
    }
  };


  // Wrap the API call in retry logic
  const performAnalysis = async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
      contents: { parts: [textPart, videoPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: exerciseSchema
      }
    });
    return response;
  };

  try {
    const response = await retryWithBackoff(performAnalysis, 3, 2000);

    const text = response.text.trim();
    
    const cleanedJsonString = text.replace(/^```json\s*|```$/g, '').trim();

    if (!cleanedJsonString) {
        return [];
    }

    let parsed;
    try {
        parsed = JSON.parse(cleanedJsonString);
    } catch(parseError) {
        console.error("Failed to parse AI JSON response. Raw text:", cleanedJsonString);
        throw new Error(`The AI returned malformed JSON. Details: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    let exercisesArray: any[] | null = null;
    
    if (Array.isArray(parsed)) {
      exercisesArray = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      const potentialArray = Object.values(parsed).find(value => Array.isArray(value));
      if (Array.isArray(potentialArray)) {
        exercisesArray = potentialArray;
      }
    }
    
    if (exercisesArray) {
      const isValid = exercisesArray.every(item =>
        item &&
        typeof item.name === 'string' &&
        typeof item.description === 'string' &&
        typeof item.startTime === 'number' &&
        typeof item.endTime === 'number'
      );
      if (isValid) {
        const result = exercisesArray as ExtractedExerciseData[];

        // Cache the result if videoHash is provided
        if (videoHash) {
          const modelUsed = useProModel ? 'pro' : 'flash';
          aiCache.cacheAnalysis(videoHash, result, modelUsed);
        }

        return result;
      }
    }
    
    console.error("AI response was valid JSON but did not match the expected exercise array structure. Parsed data:", parsed);
    throw new Error('Parsed data is not a valid array of exercises.');

  } catch (error) {
    console.error("Error during AI video analysis:", error);
    if (error instanceof Error) {
        if (error.message.includes("400 Bad Request") || error.message.includes("blocked") || error.message.includes("Proxying failed")) {
             throw new Error('The AI model could not process the video. This can happen with very large, long, or complex videos. Please try a shorter, simpler clip. Error details: ' + error.message);
        }
    }
    throw new Error(`Failed to parse AI response from video. Raw response might be invalid. Error: ${error instanceof Error ? error.message : String(error)}`);
  }
};


export async function* generateWorkoutPlanWithGemini(
  availableExercises: Exercise[],
  goal: string,
  trainingDays: number,
  useProModel: boolean
): AsyncGenerator<string> {
  if (availableExercises.length === 0) {
    throw new Error("Cannot generate a plan with no exercises. Please add exercises first.");
  }
  
  const ai = getGenAIInstance();
  
  const exerciseList = availableExercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      description: ex.description,
  }));

  const prompt = `
  You are an expert fitness coach${useProModel ? ' and kinesiologist' : ''}. Your task is to create a comprehensive and well-structured 7-day workout plan. Use ONLY the list of available exercises provided. Each exercise includes a name and a description for better context.

  **User's Goal and Schedule:**
  - **Primary Goal:** ${goal}. The entire plan, including exercise selection, sets, reps, and rest times, must be tailored to achieve this goal.
  - **Training Frequency:** The user can train ${trainingDays} days per week. Create a plan with exactly ${trainingDays} training days and ${7-trainingDays} rest or active recovery days.

  **Available Exercises (use ONLY these for the plan):**
  \`\`\`json
  ${JSON.stringify(exerciseList, null, 2)}
  \`\`\`

  **Instructions:**
  1.  **Create a 7-day plan** based on the user's specified training frequency.
  2.  **Use the exercise description** to understand the equipment needed and the movement's nature to make appropriate selections for the plan. Do not simply copy the description into your output.
  3.  **Assign a clear focus for each training day** that directly supports the user's goal of "${goal}". For example, if the goal is Strength, focuses might be 'Upper Body Strength' or 'Lower Body Power'. If the goal is Hypertrophy, focuses might be 'Chest & Triceps' or 'Back & Biceps'.
  4.  **Provide appropriate sets, reps, and rest times** tailored to the goal of each specific day and the overall goal. For example:
      - **For Strength goals:** Lower reps (e.g., 4-8), longer rest (e.g., 90-180s).
      - **For Hypertrophy (Build Muscle) goals:** Moderate reps (e.g., 8-15), moderate rest (e.g., 60-90s).
      - **For Endurance/Fat Loss goals:** Higher reps (e.g., 15-20+) or timed intervals, shorter rest (e.g., 30-60s).
  5.  **Include an encouraging title, an overall description of how the plan supports the user's goal, and practical recommendations** for warming up, cooling down, and progression.
  6.  **Structure the output strictly as JSON** according to the provided schema. Ensure every planned exercise includes the 'originalExerciseId' from the list of available exercises.

  Your response MUST be a single, valid JSON object that conforms to the schema below. Do not include any text or markdown formatting outside of the JSON object itself.
  `;
  
  const workoutPlanSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A catchy, motivating title for the workout plan that reflects the user's goal." },
      description: { type: Type.STRING, description: "A brief, encouraging overview of the plan's focus and how it helps the user achieve their goal." },
      weeklySplitDescription: { type: Type.STRING, description: `A description of the weekly structure, e.g., '${trainingDays}-Day Full Body Split' or 'Push/Pull/Legs'.` },
      warmupRecommendation: { type: Type.STRING, description: "General warm-up instructions, like 5-10 minutes of light cardio and dynamic stretching." },
      cooldownRecommendation: { type: Type.STRING, description: "General cool-down instructions, like 5-10 minutes of static stretching for muscles worked." },
      progressionTips: { type: Type.STRING, description: "Tips on how to progress over time, such as increasing weight, reps, or reducing rest, relevant to the user's goal." },
      weeklyPlan: {
        type: Type.ARRAY,
        description: "An array of 7 workout days, one for each day of the week (e.g., 'Monday', 'Tuesday', ... 'Sunday').",
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING, description: "The day of the week (e.g., 'Monday')." },
            focus: { type: Type.STRING, description: "The main focus for the day, e.g., 'Upper Body Strength', 'Leg Day', 'Full Body', or 'Rest'." },
            exercises: {
              type: Type.ARRAY,
              description: "A list of exercises planned for the day. Should be an empty array for rest days.",
              items: {
                type: Type.OBJECT,
                properties: {
                  originalExerciseId: { type: Type.STRING, description: "The unique ID of the exercise from the provided available exercises list." },
                  name: { type: Type.STRING, description: "The name of the exercise, matching the name from the available list." },
                  sets: { type: Type.STRING, description: "The number of sets to perform, e.g., '3-4'." },
                  reps: { type: Type.STRING, description: "The number of repetitions per set, e.g., '8-12'." },
                  rest: { type: Type.STRING, description: "The rest period between sets, e.g., '60-90 seconds'." },
                },
                required: ["originalExerciseId", "name", "sets", "reps", "rest"],
              }
            },
            notes: { type: Type.STRING, description: "Any additional notes for the day, such as 'Focus on form' or 'Go heavy today'." },
          },
          required: ["day", "focus", "exercises"],
        }
      }
    },
    required: ["title", "description", "weeklySplitDescription", "weeklyPlan", "warmupRecommendation", "cooldownRecommendation", "progressionTips"]
  };

  const modelConfig = {
      responseMimeType: "application/json",
      responseSchema: workoutPlanSchema,
      ...(useProModel && { thinkingConfig: { thinkingBudget: 32768 } })
  };

  const chat: Chat = ai.chats.create({
      model: useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash',
      config: modelConfig,
  });

  const responseStream = await chat.sendMessageStream({ message: prompt });

  for await (const chunk of responseStream) {
      if(chunk.text) {
          yield chunk.text;
      }
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = (reader.result as string).split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const ai = getGenAIInstance();
    try {
        const audioData = await blobToBase64(audioBlob);
        const audioPart = {
            inlineData: {
                mimeType: audioBlob.type,
                data: audioData,
            },
        };
        const textPart = { text: "Transcribe the following audio recording accurately." };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, audioPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error during audio transcription:", error);
        throw new Error("Failed to transcribe audio.");
    }
};

export const getQuickExerciseTip = async (exerciseName: string, exerciseDescription: string): Promise<string> => {
    const ai = getGenAIInstance();
    const prompt = `You are a concise fitness coach. Give me one quick, actionable tip for performing a '${exerciseName}'. The exercise is described as: '${exerciseDescription}'. The tip should focus on form, breathing, or mind-muscle connection. Keep the tip under 30 words and start directly with the advice.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error getting quick tip:", error);
        throw new Error("Failed to get quick tip.");
    }
};
