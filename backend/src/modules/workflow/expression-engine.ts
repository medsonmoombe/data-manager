/**
 * Lightweight expression engine for workflow variable resolution.
 * Supports: {{record.data.field}}, {{variable}}, nested objects, arrays, defaults.
 * 
 * Example:
 * resolveExpression("Hello {{record.data.first_name}}", { record: { data: { first_name: "John" } } })
 * → "Hello John"
 */
export class ExpressionEngine {
  /**
   * Resolve all {{expressions}} in a string against a context object.
   */
  static resolve(template: string, context: Record<string, any>): string {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\{\{(.+?)\}\}/g, (match, expression) => {
      const trimmed = expression.trim();
      const resolved = this.resolveValue(trimmed, context);
      return resolved !== undefined && resolved !== null ? String(resolved) : match;
    });
  }

  /**
   * Resolve a single expression path like "record.data.first_name" or "record.data.age > 18"
   */
  static resolveValue(path: string, context: Record<string, any>): any {
    // Handle boolean expressions
    if (this.isBooleanExpression(path)) {
      return this.evaluateBooleanExpression(path, context);
    }

    // Handle default values: "record.data.phone || 'No phone'"
    if (path.includes('||')) {
      const parts = path.split('||').map(p => p.trim());
      for (const part of parts) {
        const value = this.resolvePath(part, context);
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    }

    // Handle default values: "record.data.name ?? 'Unknown'"
    if (path.includes('??')) {
      const [main, fallback] = path.split('??').map(p => p.trim());
      const value = this.resolvePath(main, context);
      return value ?? this.resolvePath(fallback, context);
    }

    return this.resolvePath(path, context);
  }

  /**
   * Resolve a dot-notation path with array access.
   * "record.data.family_members[0].name"
   */
  private static resolvePath(path: string, context: Record<string, any>): any {
    // Remove surrounding quotes if present
    path = path.replace(/^['"]|['"]$/g, '');

    // Split by dots but not inside brackets
    const segments = path.split(/\.(?![^\[]*\])/);
    let current: any = context;

    for (const segment of segments) {
      // Handle array access: "family_members[0]"
      const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        current = current?.[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
        continue;
      }

      // Handle bracket-only: "[0]"
      const bracketMatch = segment.match(/^\[(\d+)\]$/);
      if (bracketMatch && Array.isArray(current)) {
        current = current[parseInt(bracketMatch[1])];
        continue;
      }

      current = current?.[segment];
      if (current === undefined) return undefined;
    }

    return current;
  }

  /**
   * Check if expression is a boolean condition.
   */
  private static isBooleanExpression(path: string): boolean {
    return /[><=!]/.test(path) && !path.startsWith('{{');
  }

  /**
   * Evaluate simple boolean expressions.
   */
  private static evaluateBooleanExpression(expression: string, context: Record<string, any>): boolean {
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    for (const op of operators) {
      const index = expression.indexOf(op);
      if (index === -1) continue;

      const left = expression.substring(0, index).trim();
      const right = expression.substring(index + op.length).trim();

      const leftValue = this.resolvePath(left, context);
      const rightValue = isNaN(Number(right)) ? this.resolvePath(right, context) : Number(right);

      switch (op) {
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        case '>': return Number(leftValue) > Number(rightValue);
        case '<': return Number(leftValue) < Number(rightValue);
        case '>=': return Number(leftValue) >= Number(rightValue);
        case '<=': return Number(leftValue) <= Number(rightValue);
      }
    }

    return false;
  }
}