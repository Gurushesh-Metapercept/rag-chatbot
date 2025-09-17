// Hybrid Search: Combines semantic similarity with keyword matching
export class HybridSearch {
  static keywordSearch(query, documents, k = 3) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return documents
      .map(doc => {
        const content = doc.pageContent.toLowerCase();
        const matches = queryTerms.filter(term => content.includes(term));
        const score = matches.length / queryTerms.length;
        
        return { ...doc, keywordScore: score };
      })
      .filter(doc => doc.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, k);
  }
  
  static combineResults(semanticResults, keywordResults, alpha = 0.7) {
    const combined = new Map();
    
    // Add semantic results
    semanticResults.forEach((doc, index) => {
      const id = doc.pageContent.substring(0, 50);
      combined.set(id, {
        ...doc,
        semanticRank: index,
        keywordRank: Infinity,
        combinedScore: alpha * doc.score
      });
    });
    
    // Add keyword results
    keywordResults.forEach((doc, index) => {
      const id = doc.pageContent.substring(0, 50);
      if (combined.has(id)) {
        const existing = combined.get(id);
        existing.keywordRank = index;
        existing.combinedScore += (1 - alpha) * doc.keywordScore;
      } else {
        combined.set(id, {
          ...doc,
          semanticRank: Infinity,
          keywordRank: index,
          combinedScore: (1 - alpha) * doc.keywordScore
        });
      }
    });
    
    return Array.from(combined.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
  }
}