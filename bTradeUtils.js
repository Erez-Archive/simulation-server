function getPrecision(num) {
  let count = 0;
  while (num < 1) {
    num = num * 10;
    count++;
  }
  return count;
}

function getNumOfDecimals(num) {
  return (num + "").split(".")[1].length;
}

const coolDown = miliseconds => new Promise((resolve, reject) => setTimeout(resolve, miliseconds));

module.exports = {
  getPrecision,
  getNumOfDecimals,
  coolDown
};
