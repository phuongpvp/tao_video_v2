import { GoogleGenAI, Type } from "@google/genai";
import type { FormData, GeneratedScript, Character } from '../types';

// XÓA BỎ HOÀN TOÀN khối:
// if (!process.env.API_KEY) { ... }
// và
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Thay đổi: Hàm giờ đây nhận 'apiKey' làm tham số
export async function generateScript(formData: FormData, apiKey: string): Promise<GeneratedScript> {
    
    // THÊM MỚI: Tạo instance 'ai' bên trong hàm
    const ai = new GoogleGenAI({ apiKey });

    const numberOfPrompts = Math.floor((formData.duration * 60) / 8);
    if (numberOfPrompts <= 0) {
        throw new Error("Duration is too short to generate any scenes.");
    }

    const prompt = `
Act as a professional video scriptwriter. Your task is to generate a complete video script based on the following specifications. The output MUST be a valid JSON object that adheres to the provided schema.

**Specifications:**
- **Video Idea:** ${formData.idea}
- **Cinematic Style:** ${formData.style}
- **Number of Main Characters:** ${formData.mainCharacters}
- **Number of Side Characters:** ${formData.sideCharacters}
- **Total Scenes:** ${numberOfPrompts} (Each scene should represent an 8-second video prompt)
- **Language:** ${formData.language}
- **Script Type:** ${formData.scriptType}

**Instructions:**
1.  **Create Characters:** First, create compelling characters based on the video idea and the specified numbers. Provide a name and a brief description for each character in the requested language. Classify each character's type as either 'Main' or 'Side'.
2.  **Write the Script:** Write a script divided into exactly ${numberOfPrompts} scenes.
3.  **Scene Characters:** For each scene, you MUST specify which characters are present in a list of their names. The names must exactly match the character names created in step 1. A maximum of 3 characters are allowed per scene.
4.  **Scene Prompts:** For each scene, create a descriptive prompt suitable for a video generation AI. This prompt should describe the visual elements, character actions, and setting, consistent with the cinematic style.
5.  **Dialogue/Narration:**
    - If the Script Type is "Lời thoại" (Dialogue), include dialogue for the characters in each relevant scene.
    - If the Script Type is "Lời dẫn" (Narration), include a narrator's voice-over for each relevant scene.
6.  **JSON Output:** Format the entire output as a single JSON object. Do not include any text, markdown, or code block fences before or after the JSON object.

The language of all generated text content (character descriptions, prompts, dialogue, narration) MUST be in ${formData.language}.
`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            characters: {
                type: Type.ARRAY,
                description: "List of characters in the story.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Character's name." },
                        description: { type: Type.STRING, description: "Brief description of the character." },
                        type: { type: Type.STRING, description: "Character type. Must be either 'Main' or 'Side'." }
                    },
                    required: ["name", "description", "type"]
                }
            },
            scenes: {
                type: Type.ARRAY,
                description: `List of ${numberOfPrompts} scenes for the video script.`,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        scene: { type: Type.INTEGER, description: "Scene number." },
                        prompt: { type: Type.STRING, description: "A descriptive prompt for an AI video generator for this 8-second scene." },
                        characters: {
                            type: Type.ARRAY,
                            description: "Names of the characters present in this scene. Must match names from the 'characters' list.",
                            items: { type: Type.STRING }
                        },
                        ...(formData.scriptType === 'Lời thoại' ? {
                            dialogue: { type: Type.STRING, description: "Dialogue for the scene in the specified language. Can be empty." }
                        } : {
                            narration: { type: Type.STRING, description: "Narration for the scene in the specified language. Can be empty." }
                        })
                    },
                    required: ["scene", "prompt", "characters", formData.scriptType === 'Lời thoại' ? 'dialogue' : 'narration']
                }
            }
        },
        required: ["characters", "scenes"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-1.5-pro", // Đổi sang 1.5 pro cho mạnh
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.8,
        },
    });
    
    const jsonText = response.text.trim();
    try {
        return JSON.parse(jsonText) as GeneratedScript;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", jsonText);
        throw new Error("Received invalid JSON from the API.");
    }
}

// Thay đổi: Hàm giờ đây nhận 'apiKey' làm tham số
export async function generateCharacterImagePrompt(
  character: Omit<Character, 'imagePrompt'>, 
  style: string, 
  idea: string,
  language: string,
  apiKey: string // Thêm tham số apiKey
): Promise<string> {

    // THÊM MỚI: Tạo instance 'ai' bên trong hàm
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Based on the following video idea, cinematic style, and character description, generate a detailed and descriptive image prompt in English for an AI image generator. The prompt should capture the character's appearance, clothing, mood, and key attributes.

- Video Idea: "${idea}"
- Cinematic Style: "${style}"
- Character Name: "${character.name}"
- Character Description (in ${language}): "${character.description}"

The prompt MUST be in English.
The prompt should be suitable for a realistic or stylized image generation model, matching the cinematic style.
Do not include the character's name in the prompt itself.
The final output must be only the prompt text, without any introductory phrases, explanations, or markdown formatting.
`;

    const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", // Đổi sang 1.5 flash cho nhanh
        contents: prompt,
        config: {
            temperature: 0.7,
        }
    });

    const imagePrompt = response.text.trim();
    return `${imagePrompt} Solid white background.`;
}