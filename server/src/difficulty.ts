export enum Difficulty {
    PST = 0,
    PRS = 1,
    FTR = 2,
    BYD = 3,
    ETR = 4
}

export const getDifficulty = (uri: string): Difficulty => {
    let difficultyCode = Number(uri[uri.lastIndexOf('.') - 1])
    switch (difficultyCode) {
        case 0:
            return Difficulty.PST
        case 1:
            return Difficulty.PRS
        case 2:
            return Difficulty.FTR
        case 3:
            return Difficulty.BYD
        case 4:
            return Difficulty.ETR
        default:
            console.log(`Unknown difficulty code '${difficultyCode}', treated as FTR.`)
            console.log(`*Hint: We just detect the difficulty code via the last char before ".aff".`)
            return Difficulty.FTR
    }
}
