import { jsPDF } from "jspdf";

export const loadFont = async () => {
  const fontPath = process.env.PUBLIC_URL + '/fonts/DejaVuSans.ttf';
  try {
    const fontResponse = await fetch(fontPath);
    const fontBuffer = await fontResponse.arrayBuffer();
    const fontFace = new FontFace('DejaVuSans', fontBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);

    jsPDF.API.events.push(['addFonts', function() {
      this.addFileToVFS('DejaVuSans-normal.ttf', fontBuffer);
      this.addFont('DejaVuSans-normal.ttf', 'DejaVuSans', 'normal');
    }]);
  } catch (error) {
    console.error('Chyba při načítání fontu:', error);
  }
};