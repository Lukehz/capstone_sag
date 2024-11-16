/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [    
    './public/**.html',
    './public/**/*.js',
    './public/**/*.html',
    './src/**/*.ejs',
    './src/*.ejs',

 ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'], // Incluye "DM Sans" como fuente principal
      },
    },
  },
  plugins: [],
}

