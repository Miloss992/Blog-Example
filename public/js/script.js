function Button() {
    const button = document.getElementById('button-toggle');
    if (altNav.hidden) {
        altNav.hidden = false;
    } else {
        altNav.hidden = true;
    }
}