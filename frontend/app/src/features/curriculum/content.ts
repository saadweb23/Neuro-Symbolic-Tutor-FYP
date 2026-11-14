/** Authored curriculum copy: what each concept is and what a student should be able to do after it.
 *  This is course content, not student data. Keys are the backend's concept names (graph_builder.CONCEPTS);
 *  a test keeps the two in step. */
export interface ConceptInfo {
  summary: string
  objectives: [string, string, string]
}

export const CONCEPT_INFO: Record<string, ConceptInfo> = {
  Syntax: {
    summary: 'How Python code is written: indentation, statements, comments and the rules the interpreter enforces.',
    objectives: ['Write valid statements with correct indentation', 'Add comments and read simple error messages', 'Run a short script end to end'],
  },
  'Primitive Data Types': {
    summary: 'The built-in value types: integers, floats, strings and booleans, and how they differ.',
    objectives: ['Tell int, float, str and bool apart', 'Convert between types explicitly', 'Predict what type an expression produces'],
  },
  Variables: {
    summary: 'Names that refer to values: assignment, naming rules and how a name can be rebound.',
    objectives: ['Assign and reassign variables', 'Choose clear, legal names', 'Trace how a value changes line by line'],
  },
  'Arithmetic Operators': {
    summary: 'Calculating with + - * / // % and **, including precedence and mixed number types.',
    objectives: ['Apply operators in the right order', 'Use floor division and modulo', 'Combine operators with assignment'],
  },
  'Relational Operators': {
    summary: 'Comparing values with == != < > <= >= and combining results with and, or, not.',
    objectives: ['Write comparisons that evaluate to True or False', 'Combine conditions with and / or / not', 'Avoid the = versus == mistake'],
  },
  Conditionals: {
    summary: 'Choosing what code runs using if, elif and else.',
    objectives: ['Write if / elif / else chains', 'Nest conditions without confusion', 'Predict which branch runs for a given input'],
  },
  'While Loops': {
    summary: 'Repeating code while a condition stays true, and making sure the loop can end.',
    objectives: ['Write a loop with a clear stopping condition', 'Update loop variables correctly', 'Recognise and fix an infinite loop'],
  },
  'For Loops': {
    summary: 'Iterating over a sequence or range, one item at a time.',
    objectives: ['Loop over ranges, strings and lists', 'Use range() with start, stop and step', 'Accumulate a result across iterations'],
  },
  'Loop Control': {
    summary: 'Steering a loop with break and continue.',
    objectives: ['Stop a loop early with break', 'Skip an iteration with continue', 'Choose between a condition and a break'],
  },
  'Nested Loops': {
    summary: 'Putting one loop inside another to work with grids and combinations.',
    objectives: ['Trace the order of nested iterations', 'Print patterns and tables', 'Estimate how many times the inner body runs'],
  },
  Lists: {
    summary: 'Ordered, changeable collections: creating, indexing, slicing and looping over them.',
    objectives: ['Index and slice a list', 'Add, change and remove items', 'Loop over a list and build a new one'],
  },
  'List Methods': {
    summary: 'The built-in list operations: append, extend, insert, remove, pop, sort and more.',
    objectives: ['Pick the right method for a task', 'Know which methods change the list in place', 'Sort and reverse safely'],
  },
  Tuples: {
    summary: 'Ordered collections that cannot be changed, and when to prefer them over lists.',
    objectives: ['Create and unpack tuples', 'Explain why tuples are immutable', 'Return several values using a tuple'],
  },
  Sets: {
    summary: 'Unordered collections of unique items, with fast membership tests and set algebra.',
    objectives: ['Remove duplicates with a set', 'Use union, intersection and difference', 'Test membership efficiently'],
  },
  Dictionaries: {
    summary: 'Key-value mappings: storing, looking up, updating and iterating over pairs.',
    objectives: ['Create and update a dictionary', 'Look up keys safely with get()', 'Iterate over keys, values and items'],
  },
  'Function Definition': {
    summary: 'Packaging code you can reuse by name with def, parameters and a body.',
    objectives: ['Define and call a function', 'Document a function with a docstring', 'Split a problem into small functions'],
  },
  Arguments: {
    summary: 'Passing information into functions: positional, keyword and default arguments.',
    objectives: ['Use positional and keyword arguments', 'Give parameters default values', 'Accept a variable number of arguments'],
  },
  'Return Values': {
    summary: 'Getting results back from a function with return, including returning several values.',
    objectives: ['Return a value and use it', 'Tell return apart from print', 'Return multiple values as a tuple'],
  },
  'Variable Scope': {
    summary: 'Where a name is visible: local, enclosing and global scope.',
    objectives: ['Predict which variable a name refers to', 'Avoid accidental shadowing', 'Use global and nonlocal sparingly and correctly'],
  },
  Recursion: {
    summary: 'A function that solves a problem by calling itself on a smaller version of it.',
    objectives: ['Identify the base case and recursive step', 'Trace a recursive call stack', 'Rewrite a simple loop as recursion'],
  },
  'String Manipulation': {
    summary: 'Working with text: slicing, searching, splitting, joining and formatting.',
    objectives: ['Slice and search strings', 'Split, join and strip text', 'Format output with f-strings'],
  },
  'Error Handling': {
    summary: 'Dealing with failures gracefully using try, except, else and finally.',
    objectives: ['Catch specific exceptions', 'Use else and finally correctly', 'Raise an exception on invalid input'],
  },
  'File IO': {
    summary: 'Reading from and writing to files safely with open() and context managers.',
    objectives: ['Read a file line by line', 'Write and append text', 'Use with so files always close'],
  },
  'List Comprehensions': {
    summary: 'Building lists in one readable expression, with optional filtering.',
    objectives: ['Rewrite a loop as a comprehension', 'Filter items inside a comprehension', 'Know when a loop is clearer'],
  },
  Modules: {
    summary: 'Reusing code across files with import, the standard library and your own modules.',
    objectives: ['Import names from the standard library', 'Use from-import and aliases', 'Organise code into your own module'],
  },
}
