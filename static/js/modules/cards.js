// Cards UI Logic
import { addToQueue } from './api.js';

// Currently, search.js handles card creation for search results manually.
// If we had shared card generation logic, it would go here.
// For now, this module might handle specific click logic if we decide to decouple it further.

export function handleCardClick(e, cardElement, itemData) {
    // Placeholder for future unified card handling
    console.log("Card Clicked", itemData);
}

// We can move the HTML generation for cards here if we want to reuse it between Search and other views (like Recommendations?)
export function createCardHTML(item) {
    // Logic extracted from search.js could go here
    return `...`; 
}
