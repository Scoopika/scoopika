const recorder = new Scoopika.AudioRecorder();

(async () => {
  const init = await recorder.init();
  console.log(init);
  console.log(recorder);
})();
