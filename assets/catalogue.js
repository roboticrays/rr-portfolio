// Wireframe assets are lightweight, texture-free derivatives of the supplied OBJ exports.
window.RR_CATEGORIES = ["Footwear", "Sport", "Play", "Bags"];
window.RR_COLLECTION = [
  { id: 'shoe', number: '001', title: 'Leather sneaker', category: 'Footwear', tags: ['Leather', 'Stitching', 'Surface detail'], description: 'The familiar, seen differently. Soft folds, fine stitching and the character of a well-worn surface.', cover: 'media/images/shoe-cover.jpg', full: 'media/images/shoe-reconstruction-full.jpg', video: 'media/video/shoe-showroom.mp4', photo: 'media/images/shoe-photo.jpg', model: 'media/models/shoe-wireframe.glb', modelNote: 'This 3D model shows a different shoe from the photograph and rendered video.', wireframe: true, tone: 'stone' },
  { id: 'ball', number: '002', title: 'Sports ball', category: 'Sport', tags: ['Curved form', 'Colour', 'Surface texture'], description: 'Colour in the round. A study of curved geometry, printed graphics and the texture between the lines.', cover: 'media/images/ball-cover.jpg', full: 'media/images/ball-reconstruction-full.jpg', video: 'media/video/ball-showroom.mp4', photo: 'media/images/ball-photo.jpg', model: 'media/models/ball-wireframe.glb', wireframe: true, tone: 'sand' },
  { id: 'wooden-toy', number: '003', title: 'Wooden play bench', category: 'Play', tags: ['Wood', 'Painted surfaces', 'Mixed geometry'], description: 'A little world of colour. Wood grain, painted pegs and playful geometry, captured together.', cover: 'media/images/wooden-toy-cover.jpg', full: 'media/images/wooden-toy-reconstruction-full.jpg', video: 'media/video/wooden-toy-showroom.mp4', photo: 'media/images/wooden-toy-photo.jpg', model: 'media/models/wooden-toy-wireframe.glb', wireframe: true, tone: 'sage' }
];

// These are proposed directions, not completed scans or claimed capabilities.
window.RR_PLANNED = [
  { number: '004', name: 'Bags / pilot collection', category: 'Bags', drawing: '<path d="M24 30h48l6 48H18l6-48Zm12 0V20a12 12 0 0 1 24 0v10M26 43h44M35 50v14m26-14v14"/>' },
  { number: '005', name: 'Objects of craft', category: 'Ceramics', drawing: '<path d="M35 16h26v12c0 12 14 14 14 32a27 27 0 0 1-54 0c0-18 14-20 14-32V16Zm1 6h24M27 59c8 4 33 4 42 0M34 77h28"/>' },
  { number: '006', name: 'A finer frame', category: 'Eyewear', drawing: '<path d="m15 40 5-17h12m49 17-5-17H64M12 43h30v16a12 12 0 0 1-25 0l-5-16Zm42 0h30l-5 16a12 12 0 0 1-25 0V43Zm-12 7c4-5 8-5 12 0M8 42h4m72 0h4"/>' },
  { number: '007', name: 'Form & function', category: 'Home objects', drawing: '<path d="M30 14h36v35H30V14Zm0 35-9 16h54l-9-16M26 65v20m44-20v20M35 65v13m26-13v13M35 22h26"/>' },
  { number: '008', name: 'Small essentials', category: 'Personal care', drawing: '<path d="M34 32h28v51H34V32Zm6 0V18h16v14M40 24h16M43 18V9h25v6H49M39 58h18M39 64h12"/>' },
  { number: '009', name: 'Built to fit', category: 'Industrial parts', drawing: '<path d="m48 13 8 4 9-1 3 10 8 5-3 9 3 9-8 5-3 10-9-1-8 4-8-4-9 1-3-10-8-5 3-9-3-9 8-5 3-10 9 1 8-4Z"/><circle cx="48" cy="40" r="13"/><path d="M36 67v13h24V67M41 74h14"/>' },
  { number: '010', name: 'Your next object', category: 'An open invitation', drawing: '<path d="m48 14 29 16v33L48 80 19 63V30l29-16Zm0 33 29-17M48 47 19 30m29 17v33M37 32h22m-11-11v22"/>' }
];
