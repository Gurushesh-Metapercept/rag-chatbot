// Quality metrics to evaluate RAG performance
export class QualityMetrics {
  static evaluateResponse(query, context, response) {
    return {
      contextRelevance: this.calculateContextRelevance(query, context),
      responseCompleteness: this.calculateCompleteness(query, response),
      factualAccuracy: this.checkFactualAccuracy(context, response)
    };
  }
  
  static calculateContextRelevance(query, context) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contextTerms = context.toLowerCase().split(/\s+/);
    
    const overlap = queryTerms.filter(term => 
      contextTerms.some(cTerm => cTerm.includes(term) || term.includes(cTerm))
    );
    
    return overlap.length / queryTerms.length;
  }
  
  static calculateCompleteness(query, response) {
    // Simple heuristic: longer responses are more complete
    const expectedLength = Math.min(query.length * 3, 500);
    return Math.min(response.length / expectedLength, 1.0);
  }
  
  static checkFactualAccuracy(context, response) {
    // Check if response contains information not in context
    const responseWords = response.toLowerCase().split(/\s+/);
    const contextWords = context.toLowerCase().split(/\s+/);
    
    const supportedWords = responseWords.filter(word => 
      contextWords.includes(word) || word.length < 4 // Skip common words
    );
    
    return supportedWords.length / responseWords.length;
  }
}