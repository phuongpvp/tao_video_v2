



import React, { useState, useCallback } from 'react';
import { CINEMATIC_STYLES, LANGUAGES, SCRIPT_TYPES } from './constants';
import { generateScript, generateCharacterImagePrompt } from './services/geminiService';
import type { FormData, GeneratedScript, Character, Scene } from './types';

const initialFormData: FormData = {
    idea: '',
    duration: 3,
    mainCharacters: 2,
    sideCharacters: 1,
    style: CINEMATIC_STYLES[3],
    language: LANGUAGES[0],
    scriptType: SCRIPT_TYPES[0],
};

const buildVideoPrompt = (scene: Scene, allCharacters: Character[], scriptType: string): string => {
    const sceneCharacters = allCharacters
        .filter(char => scene.characters.includes(char.name))
        .slice(0, 3); // Limit to a maximum of 3 characters

    const characterPrompts = sceneCharacters
        .map(char => {
            const description = char.imagePrompt?.replace(' Solid white background.', '').trim() || char.description;
            return `${char.name}: ${description}`;
        })
        .join('. ');

    const scriptLine = scriptType === 'Lời thoại' ? scene.dialogue : scene.narration;

    const finalPrompt = [characterPrompts, scene.prompt, scriptLine]
        .filter(Boolean)
        .join('. ');

    return finalPrompt;
};

const transformScriptToVEOFormat = (script: GeneratedScript, formData: FormData): object => {
    const charactersWithIds = script.characters.map(char => ({
        ...char,
        id: `char_${char.name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')}`,
        seed: Math.floor(Math.random() * 100000),
    }));

    const characterDescriptions = charactersWithIds.map(char => ({
        id: char.id,
        name: char.name,
        physicalAppearance: char.imagePrompt?.replace(' Solid white background.', '').trim() || char.description,
        clothing: "Described in physical appearance prompt.",
        characterTraits: "Described in physical appearance prompt.",
        voiceType: "N/A",
        seed: char.seed
    }));

    const scenes = script.scenes.map((scene, index) => {
        const participatingCharacterIds = scene.characters
            .map(charName => charactersWithIds.find(c => c.name === charName)?.id)
            .filter((id): id is string => !!id);

        const videoPrompt = buildVideoPrompt(scene, script.characters, formData.scriptType);

        let dialogues: { character: string, line: string }[] = [];
        if (formData.scriptType === 'Lời thoại' && scene.dialogue) {
            dialogues = scene.dialogue.split('\n')
                .map(line => line.trim())
                .filter(line => line.includes(':'))
                .map(line => {
                    const [character, ...lineParts] = line.split(':');
                    return { character: character.trim(), line: lineParts.join(':').trim() };
                }).filter(d => d.character && d.line);
        }

        return {
            type: "scene",
            inherit: "project",
            sceneId: `scene_${String(index + 1).padStart(3, '0')}`,
            sceneNumber: index + 1,
            sceneTitle: `${scene.prompt.substring(0, 50)}...`,
            durationSec: 8,
            setting: {
                place: "Varies",
                timeOfDay: "day",
                locationId: "loc_generic"
            },
            participatingCharacters: participatingCharacterIds,
            prompt: videoPrompt,
            visual: {
                lighting: "Natural",
                colorPalette: ["cold", "desaturated", "warm_firelight_accents"],
                pace: "normal",
                shots: [{
                    id: `s${String(index + 1).padStart(3, '0')}`,
                    template: "medium",
                    camera: `${scene.prompt.substring(0, 50)}...`,
                    durationHint: 4,
                    seed: Math.floor(Math.random() * 100000),
                    shotPrompt: videoPrompt
                }]
            },
            audio: {
                dialogues: dialogues,
                music: { style: "orchestral", mood: "epic and emotional" },
                sfx: []
            },
            meta: {
                order: index + 1,
                notes: "Generated from video script generator app.",
                generatedAt: new Date().toISOString()
            }
        };
    });

    const veoJson = {
        version: "3.0.0",
        type: "project",
        projectId: `project_${formData.idea.substring(0, 20).toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')}`,
        metadata: {
            title: formData.idea.substring(0, 50) || "Generated Project",
            genre: "adventure",
            style: "Điện ảnh sinh tồn (Epic)",
            mood: ["epic", "emotional"],
            audience: "Teen+",
            aspectRatio: "16:9",
            language: formData.language === 'Tiếng Việt' ? 'vi-VN' : 'en-US',
        },
        continuity: {
            styleFingerprint: "generated_style_v1",
            globalSeed: 54776,
            locks: { characterLock: true, lightingLock: true, paletteLock: true, assetLock: true, scaleLock: true },
            characterSeeds: charactersWithIds.reduce((acc, char) => {
                acc[char.id] = char.seed;
                return acc;
            }, {} as Record<string, number>)
        },
        defaults: {
            lighting: "Natural",
            colorPalette: ["cold", "desaturated", "warm_firelight_accents"],
            pace: "normal",
            seedStrategy: "inherit_per_scene_then_offset_per_shot",
            styleStrength: 0.9,
            denoiseStrength: 0.35,
            negativePrompts: ["flicker", "model drift", "face/hand deformation"],
            cameraRules: { moveSpeed: "slow_to_medium", noHandheld: true, avoid: ["whip pans", "unmotivated angle flips"] }
        },
        characterDescriptions: characterDescriptions,
        assets: { props: {}, locations: {} },
        shotTemplates: {
            establishing_wide: { lens: "35mm eq.", move: "slow pan or slow dolly-in", durationHint: 4 },
            medium: { lens: "50mm eq.", move: "gentle static with micro parallax", durationHint: 4 },
            close_up: { lens: "75mm eq.", move: "subtle push-in", durationHint: 3 }
        },
        veo3Settings: { resolution: "1080p", fps: 24, motion: "medium", continuityPriority: true, seedRespect: "strict" },
        globalContext: {
            logline: formData.idea,
            themes: ["survival", "friendship", "adventure"],
            visualPalette: { lighting: "Natural", colorPalette: ["cold_blues", "white_snow", "warm_orange_firelight"] }
        },
        audioVoSettings: {
            voiceGender: "male",
            language: formData.language === 'Tiếng Việt' ? 'vi-VN' : 'en-US',
            paceBpm: 80,
            style: "dramatic narration",
            microphone: "studio condenser cinematic",
            fx: ["slight reverb 12%", "EQ warm low-mids"],
            musicDucking: "-10dB during narration",
            exportFormat: "wav, mono 48kHz"
        },
        scenes: scenes,
        export: {
            container: "mp4",
            codec: "h264",
            bitrateTarget: "12Mbps",
            generatedAt: new Date().toISOString()
        }
    };
    return veoJson;
};


const ErrorComponent: React.FC<{ error: string }> = ({ error }) => (
    <div className="mt-8 p-6 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
        <h3 className="font-bold text-lg mb-2">Lỗi</h3>
        <p>{error}</p>
    </div>
);

const CharacterCard: React.FC<{
    character: Character;
    onNameChange: (newName: string) => void;
}> = ({ character, onNameChange }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!character.imagePrompt) return;
        navigator.clipboard.writeText(character.imagePrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const typeLabel = character.type === 'Main' ? 'Nhân vật chính' : 'Nhân vật phụ';
    const typeColor = character.type === 'Main' ? 'bg-amber-600' : 'bg-sky-600';

    return (
        <div className="bg-slate-800 rounded-lg p-6 flex flex-col gap-4 border border-slate-700">
            <div className="flex items-center justify-between">
                <input
                    type="text"
                    value={character.name}
                    onChange={(e) => onNameChange(e.target.value)}
                    className="text-2xl font-bold text-white bg-transparent border-b-2 border-slate-700 focus:border-blue-500 outline-none transition w-full mr-4"
                />
                <span className={`px-3 py-1 text-xs font-semibold text-white ${typeColor} rounded-full whitespace-nowrap`}>
                    {typeLabel}
                </span>
            </div>
            <p className="text-slate-400 text-sm">{character.description}</p>
            <div className="mt-2 bg-slate-900 p-4 rounded-md">
                <label className="text-xs font-semibold text-slate-500 uppercase">
                    Prompt tạo ảnh nhân vật (Tiếng Anh)
                </label>
                <p className="text-slate-300 font-mono text-sm mt-2 break-words">
                    {character.imagePrompt || 'Đang tạo...'}
                </p>
            </div>
            <button
                onClick={handleCopy}
                disabled={!character.imagePrompt}
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
            >
                {copied ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Đã sao chép
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Sao chép
                    </>
                )}
            </button>
        </div>
    );
};


const CharacterCustomization: React.FC<{
    script: GeneratedScript;
    setScript: React.Dispatch<React.SetStateAction<GeneratedScript | null>>;
    setStep: React.Dispatch<React.SetStateAction<number>>;
}> = ({ script, setScript, setStep }) => {

    const handleCharacterNameChange = (characterIndex: number, newName: string) => {
        const oldName = script.characters[characterIndex].name;

        if (oldName === newName) {
            return; // No change needed
        }

        // 1. Update the character's name in the main characters list
        const updatedCharacters = script.characters.map((char, index) =>
            index === characterIndex ? { ...char, name: newName } : char
        );

        // 2. Update the name in all scenes (character lists and dialogue)
        const updatedScenes = script.scenes.map(scene => {
            const updatedSceneCharacters = scene.characters.map(charName =>
                charName === oldName ? newName : charName
            );

            let updatedDialogue = scene.dialogue;
            if (updatedDialogue) {
                // Use a regex to safely replace the speaker's name at the beginning of lines
                const regex = new RegExp(`^(${oldName}:)`, 'gm');
                updatedDialogue = updatedDialogue.replace(regex, `${newName}:`);
            }

            return {
                ...scene,
                characters: updatedSceneCharacters,
                dialogue: updatedDialogue,
            };
        });

        // 3. Set the new, fully updated script state
        setScript({
            characters: updatedCharacters,
            scenes: updatedScenes,
        });
    };

    return (
        <div className="mt-10">
            <h2 className="text-3xl font-bold text-cyan-400 mb-6">Bước 2: Tinh chỉnh nhân vật</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {script.characters.map((char, index) => (
                    <CharacterCard
                        key={index}
                        character={char}
                        onNameChange={(newName) => handleCharacterNameChange(index, newName)}
                    />
                ))}
            </div>
             <div className="mt-10">
                <button
                    onClick={() => setStep(3)}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-4 rounded-lg text-lg transition-all duration-200"
                >
                    Tiếp tục: Viết kịch bản
                </button>
            </div>
        </div>
    );
};

const SceneCard: React.FC<{
    scene: Scene;
    allCharacters: Character[];
    scriptType: string;
}> = ({ scene, allCharacters, scriptType }) => {
    const [promptCopied, setPromptCopied] = useState(false);
    const [dialogueCopied, setDialogueCopied] = useState(false);

    const finalVideoPrompt = buildVideoPrompt(scene, allCharacters, scriptType);

    const handleCopy = (text: string, type: 'prompt' | 'dialogue') => {
        navigator.clipboard.writeText(text);
        if (type === 'prompt') {
            setPromptCopied(true);
            setTimeout(() => setPromptCopied(false), 2000);
        } else {
            setDialogueCopied(true);
            setTimeout(() => setDialogueCopied(false), 2000);
        }
    };

    const copyIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 hover:text-white transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
    );
    const copiedIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;

    return (
        <div className="bg-slate-800/70 border border-slate-700 rounded-lg flex flex-col md:flex-row overflow-hidden">
            {/* Left Panel */}
            <div className="p-6 md:w-1/2 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-slate-700">
                <h4 className="text-2xl font-bold text-amber-400">Cảnh {scene.scene}</h4>
                <div className="mt-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Mô tả</label>
                    <p className="text-slate-300 mt-1">{scene.prompt}</p>
                </div>
                {(scene.dialogue || scene.narration) && (
                     <div className="mt-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                            {scriptType}
                            <button onClick={() => handleCopy(scene.dialogue || scene.narration || '', 'dialogue')} className="ml-2">
                                {dialogueCopied ? copiedIcon : copyIcon}
                            </button>
                        </label>
                        <p className="text-slate-300 mt-1 whitespace-pre-wrap">{scene.dialogue || scene.narration}</p>
                    </div>
                )}
            </div>

            {/* Right Panel */}
            <div className="bg-slate-900/50 p-6 md:w-1/2 flex flex-col">
                <div className="flex-grow min-h-[150px]">
                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center">
                        Prompt Video
                        <button onClick={() => handleCopy(finalVideoPrompt, 'prompt')} className="ml-2">
                             {promptCopied ? copiedIcon : copyIcon}
                        </button>
                    </label>
                    <p className="text-slate-300 text-sm mt-2 break-words">
                        {finalVideoPrompt}
                    </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                     <label className="text-xs font-semibold text-slate-500 uppercase">Nhân vật</label>
                     <p className="text-slate-300 mt-1">{scene.characters.join(', ')}</p>
                </div>
            </div>
        </div>
    );
};

const ActionBar: React.FC<{
    script: GeneratedScript;
    formData: FormData;
    onReset: () => void;
}> = ({ script, formData, onReset }) => {

    const downloadFile = (filename: string, content: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPrompts = () => {
        const allPrompts = script.scenes.map(scene =>
            buildVideoPrompt(scene, script.characters, formData.scriptType)
        ).join('\n\n');
        downloadFile('video_prompts.txt', allPrompts, 'text/plain;charset=utf-8');
    };

    const handleDownloadDialogue = () => {
        const isDialogue = formData.scriptType === 'Lời thoại';
        const allLines = script.scenes
            .map(scene => (isDialogue ? scene.dialogue : scene.narration) || '')
            .filter(line => line.trim() !== '')
            .join('\n\n');
        downloadFile(isDialogue ? 'dialogue.txt' : 'narration.txt', allLines, 'text/plain;charset=utf-8');
    };

    const handleDownloadJson = () => {
        const veoJson = transformScriptToVEOFormat(script, formData);
        const jsonContent = JSON.stringify(veoJson, null, 2);
        downloadFile('project_script.json', jsonContent, 'application/json;charset=utf-8');
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center gap-3 mb-6">
            <button onClick={handleDownloadPrompts} className="px-4 py-2 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải Prompts
            </button>
            <button onClick={handleDownloadDialogue} className="px-4 py-2 flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải lời thoại
            </button>
            <button onClick={handleDownloadJson} className="px-4 py-2 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải JSON
            </button>
            <button onClick={onReset} className="ml-auto px-4 py-2 flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-md transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                Tạo kịch bản mới
            </button>
        </div>
    );
}

const ScriptView: React.FC<{ script: GeneratedScript, scriptType: string, onReset: () => void, formData: FormData }> = ({ script, scriptType, onReset, formData }) => {
    return (
        <div className="mt-10">
             <ActionBar
                script={script}
                formData={formData}
                onReset={onReset}
            />
            <h2 className="text-3xl font-bold text-amber-400 mb-6">Bước 3: Kịch bản chi tiết</h2>
            <div className="space-y-6">
                {script.scenes.map((scene, index) => (
                    <SceneCard
                        key={index}
                        scene={scene}
                        allCharacters={script.characters}
                        scriptType={scriptType}
                    />
                ))}
            </div>
        </div>
    );
};


export default function App() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [isLoading, setIsLoading] = useState(false);
    const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'duration' || name === 'mainCharacters' || name === 'sideCharacters' ? parseInt(value, 10) : value,
        }));
    };

    const handleStyleClick = (style: string) => {
        setFormData(prev => ({ ...prev, style }));
    };

    const handleReset = () => {
        setStep(1);
        setGeneratedScript(null);
        setError(null);
        setFormData(initialFormData);
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setGeneratedScript(null);
        
        try {
            // Step 1: Generate script and character descriptions
            const scriptResult = await generateScript(formData);

            // Step 2: Generate image prompts for each character
            const charactersWithPrompts = await Promise.all(
                scriptResult.characters.map(async (char) => {
                    const imagePrompt = await generateCharacterImagePrompt(
                        char,
                        formData.style,
                        formData.idea,
                        formData.language
                    );
                    return { ...char, imagePrompt };
                })
            );

            const finalScript = { ...scriptResult, characters: charactersWithPrompts };
            setGeneratedScript(finalScript);
            setStep(2);

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
            setStep(1); // Reset to form on error
        } finally {
            setIsLoading(false);
        }
    }, [formData]);


    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-7xl">
                <header className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Trình Tạo Kịch Bản Video - 0916 590 161 </h1>
                </header>

                <main>
                    {step === 1 && (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div>
                                <label htmlFor="idea" className="block text-lg font-medium text-slate-300 mb-2"> Ý tưởng video</label>
                                <textarea
                                    id="idea"
                                    name="idea"
                                    value={formData.idea}
                                    onChange={handleInputChange}
                                    placeholder="Ví dụ: Một phi hành gia bị lạc trên một hành tinh xa lạ và phải tìm cách sinh tồn..."
                                    className="w-full h-32 p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="duration" className="block text-sm font-medium text-slate-400 mb-2">Tổng thời lượng (phút)</label>
                                    <input
                                        type="number"
                                        id="duration"
                                        name="duration"
                                        value={formData.duration}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        min="1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="mainCharacters" className="block text-sm font-medium text-slate-400 mb-2">Số nhân vật chính</label>
                                    <input
                                        type="number"
                                        id="mainCharacters"
                                        name="mainCharacters"
                                        value={formData.mainCharacters}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="sideCharacters" className="block text-sm font-medium text-slate-400 mb-2">Số nhân vật phụ</label>
                                    <input
                                        type="number"
                                        id="sideCharacters"
                                        name="sideCharacters"
                                        value={formData.sideCharacters}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-medium text-slate-300 mb-3"> Phong cách điện ảnh</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    {CINEMATIC_STYLES.map(style => (
                                        <button
                                            key={style}
                                            type="button"
                                            onClick={() => handleStyleClick(style)}
                                            className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 ${formData.style === style ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}
                                        >
                                            {style}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="language" className="block text-sm font-medium text-slate-400 mb-2">Ngôn ngữ</label>
                                    <select
                                        id="language"
                                        name="language"
                                        value={formData.language}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition appearance-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                    >
                                        {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="scriptType" className="block text-sm font-medium text-slate-400 mb-2">Kiểu kịch bản</label>
                                    <select
                                        id="scriptType"
                                        name="scriptType"
                                        value={formData.scriptType}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition appearance-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                                    >
                                        {SCRIPT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-lg text-lg transition-all duration-200 flex items-center justify-center"
                            >
                                {isLoading && (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                Bước 1: Tạo Nhân Vật & Kịch Bản
                            </button>
                        </form>
                    )}

                    {error && !isLoading && <ErrorComponent error={error} />}
                    
                    {generatedScript && !isLoading && !error && (
                        <>
                             {step === 2 && (
                                 <CharacterCustomization 
                                    script={generatedScript} 
                                    setScript={setGeneratedScript}
                                    setStep={setStep}
                                />
                            )}
                            {step === 3 && (
                                <ScriptView 
                                    script={generatedScript} 
                                    scriptType={formData.scriptType}
                                    onReset={handleReset}
                                    formData={formData}
                                />
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}