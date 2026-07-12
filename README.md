# Finite State Machine Designer

A modern, web-based tool for designing finite state machines (FSM). This project allows users to draw states and transitions on an interactive canvas, manage multiple machines using local storage, share machines via URL, and export the designs to various formats including PNG, SVG, LaTeX (TikZ), and JSON.

## Acknowledgements

This project is an enhanced fork of the original [Finite State Machine Designer](https://madebyevan.com/fsm/) created by [Evan Wallace](https://madebyevan.com/) in 2010. 

## Features

- **Interactive Canvas**: Add states (double-click), create transitions (shift-drag), and drag elements to arrange your machine.
- **Rich Exports**: Export your FSM as a high-quality PNG, SVG, or directly as LaTeX (using the TikZ package) for inclusion in academic papers.
- **Import/Export JSON**: Save your work to a file and load it back later.
- **Local Storage Management**: Manage multiple FSMs simultaneously. Your work is automatically saved to your browser's local storage.
- **URL Sharing**: Generate shareable links that embed the entire FSM structure in the URL (using LZ-string compression).

## Dependencies

The project is built with a modern frontend stack using native ES modules and TypeScript:

- **Core**: HTML5 Canvas, TypeScript
- **Bundler**: [Vite](https://vitejs.dev/)
- **Libraries**: `lz-string` (for URL share compression)
- **Testing**: [Vitest](https://vitest.dev/), `jsdom` (for canvas and DOM mocking), `@vitest/coverage-v8` (for coverage reporting)

## Getting Started

### Prerequisites

You will need [Node.js](https://nodejs.org/) installed on your machine.

### Installation

Clone the repository and install the dependencies using npm:

```bash
npm install
```

### Local Development

To start the Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The server will typically start at `http://localhost:5173`.

### Building for Production

To create an optimized production build:

```bash
npm run build
```

The compiled assets will be output to the `dist/` directory, ready to be deployed to any static hosting service. You can preview the production build locally using:

```bash
npm run preview
```

## Testing

This project maintains 100% test coverage across all modules, including DOM interactions, canvas rendering logic, and data validation.

To execute the test suite:

```bash
npm run test
```

To run the tests and generate a detailed code coverage report:

```bash
npm run test:coverage
```
