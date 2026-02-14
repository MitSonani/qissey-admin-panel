"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
    placeholder?: string;
    tags: string[];
    setTags: (tags: string[]) => void;
}

export function TagInput({ placeholder, tags, setTags }: TagInputProps) {
    const [inputValue, setInputValue] = React.useState("");

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag();
        } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    };

    const addTag = () => {
        const trimmedValue = inputValue.trim().replace(/,$/, "");
        if (trimmedValue && !tags.includes(trimmedValue)) {
            setTags([...tags, trimmedValue]);
            setInputValue("");
        }
    };

    const removeTag = (index: number) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            <div className="relative group">
                <Input
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pr-10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all border-muted-foreground/20 hover:border-muted-foreground/40"
                />
                <button
                    type="button"
                    onClick={addTag}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer p-1 rounded-md hover:bg-primary/5 group-hover:text-muted-foreground"
                    title="Click or press Enter to add"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    {tags.map((tag, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="pl-2.5 pr-1 py-1 gap-1.5 transition-all hover:bg-secondary/80 border-transparent hover:border-muted-foreground/20"
                        >
                            <span className="text-xs font-medium">{tag}</span>
                            <button
                                type="button"
                                className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                                onClick={() => removeTag(index)}
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
