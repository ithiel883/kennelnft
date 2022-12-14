import { Injectable } from "@angular/core";
import Web3 from "web3";
import * as _ from "lodash";
import { KENNELADDRESS, KOMBATADDRESS, WEB3URL } from "./constants";
import fighter from "../assets/abi/fighter.json";
import kombat from "../assets/abi/kombat.json";
import trainer from "../assets/abi/training.json";
import token from "../assets/abi/token.json";

import { Observable, Subject } from "rxjs";
import { NotifyService } from "./notify.service";

@Injectable({
    providedIn: "root"
})
export class NftContractsService {

    private provider;
    private web3;

    private dataStream: Subject<any> = new Subject();
    public dataStream$: Observable<any> = this.dataStream.asObservable();

    private teamsData = {};

    constructor(
        private notifierService: NotifyService
    ) { }

    private async initWeb3() {
        if (!this.web3) {
            this.web3 = new Web3(WEB3URL[0]);
        }
    }

    // private async initWeb3() {
    //     if (!this.web3) {
    //         for (let x = 0; x < WEB3URL.length; x++) {
    //             try {
    //                 const web3 = new Web3(WEB3URL[x]);
    //                 const contractKombat = new (web3 as any).eth.Contract(kombat.output.abi, KOMBATADDRESS);
    //                 let teams = await contractKombat.methods.kennelAddress().call();                    
    //                 this.web3 = web3;
    //                 break;
    //             } catch (ex) {
    //                 console.log(ex);
    //             }
    //         }
    //     }
    // }

    private async getFighterSimplyInfo(address, tokenId): Promise<any> {
        // get fighter
        const contractFighter = new this.web3.eth.Contract(fighter.output.abi, address);
        const metadata = await contractFighter.methods.tokenURI(tokenId).call();
        const base64 = metadata.split(",")[1];
        const json = JSON.parse(Buffer.from(base64, 'base64').toString('ascii').replace("\"attributes\":\"", "\"attributes\":").replace("]\", \"image", "], \"image"));
        return { address, token: tokenId, metadata: json };
    }

    public async getKombatInfo(): Promise<{ address: string; squad: string; symbol: string }[]> {
        try {
            await this.initWeb3();
            const teamsInfo = [];

            // get teams
            const contractKombat = new this.web3.eth.Contract(kombat.output.abi, KOMBATADDRESS);

            let teams = await contractKombat.methods.allTeams().call();
            console.log(teams);
            for (const team of teams) {
                const contractFighter = new this.web3.eth.Contract(fighter.output.abi, team);
                const name = await contractFighter.methods.name().call();
                const symbol = await contractFighter.methods.symbol().call();
                let image = "";
                try {
                    image = await contractFighter.methods.defaultImage().call();
                } catch (noex) {
                    console.log(noex);
                }
                teamsInfo.push({ address: team, squad: name, symbol, image });
            }
            // get fighters info
            console.log(teamsInfo);
            return teamsInfo;
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return [];
    }

    public async getWinnings(): Promise<string> {
        try {
            await this.initWeb3();

            // get teams
            const contractKombat = new this.web3.eth.Contract(kombat.output.abi, KOMBATADDRESS);

            let winnings = await contractKombat.methods.totalPrize().call();
            winnings = winnings / (10 ** 18);
            return winnings.toFixed(7);
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return "0";
    }

    public async getPossible(): Promise<string> {
        try {
            await this.initWeb3();

            // get teams
            const contractKombat = new this.web3.eth.Contract(kombat.output.abi, KOMBATADDRESS);

            let possible = await contractKombat.methods.maxPossiblePrize().call();
            possible = possible / (10 ** 18);
            return possible.toFixed(5);
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return "0";
    }

    public async getFightInfo(): Promise<{ fightSymbol: string; fightPrice: number; origFightPrice: number }> {
        await this.initWeb3();
        const contractKombat = new this.web3.eth.Contract(kombat.output.abi, KOMBATADDRESS);
        let fightPrice = await contractKombat.methods.fightPrice().call();
        console.log("fightPrice", fightPrice);
        const fightPr = fightPrice / (10 ** 18);
        return { fightSymbol: "BNB", fightPrice: fightPr, origFightPrice: fightPrice };
    }

    public async getSquadInfo(address): Promise<{ address: string; tokenAddress: string; name: string; symbol: string; fightSymbol: string; fightPrice: number; origRecruit: any; recruitPrice: number; tokenSymbol: string }> {
        let teamsInfo = { address: "", tokenAddress: "", name: "", symbol: "", fightSymbol: "", fightPrice: 0, recruitPrice: 0, origRecruit: 0, tokenSymbol: "" };
        try {
            if (this.teamsData[address]) {
                console.log("this.teamsData[address]", this.teamsData[address]);
                return this.teamsData[address];
            }
            await this.initWeb3();

            const fightInfo = await this.getFightInfo();
            const contractFighter = new this.web3.eth.Contract(fighter.output.abi, address);
            const trainerAddress = await contractFighter.methods.trainerContract().call();
            console.log("trainerAddress", trainerAddress);
            const contractTrainer = new this.web3.eth.Contract(trainer.output.abi, trainerAddress);
            const name = await contractFighter.methods.name().call();
            const symbol = await contractFighter.methods.symbol().call();
            const recruitPrice = await contractTrainer.methods.recruitPrice().call();
            let price = 0;
            let tokenSymbol = "";
            const tokenAddress = await contractTrainer.methods.tokenAddress().call();
            if (tokenAddress) {
                const contractToken = new this.web3.eth.Contract(token.abi, tokenAddress);
                const decimals = await contractToken.methods.decimals().call();
                tokenSymbol = await contractToken.methods.symbol().call();
                price = recruitPrice / (10 ** decimals);
            }
            teamsInfo = { address, tokenAddress, name, symbol, fightPrice: fightInfo.fightPrice, fightSymbol: fightInfo.fightSymbol, origRecruit: recruitPrice, recruitPrice: price, tokenSymbol };
            this.teamsData[address] = teamsInfo;
            return teamsInfo;
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return teamsInfo;
    }

    public async getPrices(address): Promise<{
        address: string;
        tokenAddress: string;
        armorPrice: number;
        lvlUpPrice: number;
        trainingPrice: number;
        tokenSymbol: string;
        fightSymbol: string;
        fightPrice: number;
        namePrice: number;
        origArmorPrice: number;
        origLvlUpPrice: number;
        origTrainingPrice: number;
        origFightPrice: number;
        origNamePrice: number;

    }> {
        let teamsInfo = {
            address: "", tokenAddress: "", armorPrice: 0, trainingPrice: 0, lvlUpPrice: 0, tokenSymbol: "", fightSymbol: "", fightPrice: 0, namePrice: 0,
            origArmorPrice: 0, origLvlUpPrice: 0, origTrainingPrice: 0, origFightPrice: 0, origNamePrice: 0
        };
        try {
            await this.initWeb3();
            const fightInfo = await this.getFightInfo();
            const contractFighter = new this.web3.eth.Contract(fighter.output.abi, address);
            const trainerAddress = await contractFighter.methods.trainerContract().call();
            const contractTrainer = new this.web3.eth.Contract(trainer.output.abi, trainerAddress);
            const armorPrice = await contractTrainer.methods.armorPrice().call();
            const trainingPrice = await contractTrainer.methods.trainingPrice().call();
            const levelUpPrice = await contractTrainer.methods.levelUpPrice().call();
            const setNamePrice = await contractTrainer.methods.namePrice().call();

            let price = 0;
            let trainPrice = 0;
            let lvlUpPrice = 0;
            let namePrice = 0;
            let tokenSymbol = "";
            const tokenAddress = await contractTrainer.methods.tokenAddress().call();
            if (tokenAddress) {
                const contractToken = new this.web3.eth.Contract(token.abi, tokenAddress);
                tokenSymbol = await contractToken.methods.symbol().call();
                price = armorPrice / (10 ** 18);
                trainPrice = trainingPrice / (10 ** 18);
                lvlUpPrice = levelUpPrice / (10 ** 18);
                namePrice = setNamePrice / (10 ** 18);
            }
            teamsInfo = {
                address, tokenAddress, armorPrice: price, trainingPrice: trainPrice, lvlUpPrice, namePrice, tokenSymbol,
                origArmorPrice: armorPrice, origLvlUpPrice: levelUpPrice, origTrainingPrice: trainingPrice, origNamePrice: setNamePrice
                , ...fightInfo
            };
            return teamsInfo;
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Fighters contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return teamsInfo;

    }

    public async getFightersInfo(address, numFighters = 10, lastFighter?, startFighter?): Promise<any> {
        try {
            await this.initWeb3();
            // get teams
            const contractFighter = new this.web3.eth.Contract(fighter.output.abi, address);
            let start = startFighter;
            if (!startFighter) {
                let fighters = await contractFighter.methods.totalSupply().call();
                this.dataStream.next({ type: "team", fighters });
                start = fighters;
            }
            let end = lastFighter ? lastFighter : (start - numFighters);
            end = (end < 0) ? 0 : end;
            let promises = [];
            for (let fighter = (start - 1); fighter >= end; fighter--) {
                promises.push(this.getFighterBasicInfo(address, fighter));
            }
            const results = await Promise.all(promises);
            return { result: "ok" };
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
            return { result: "error" };
        }
    }

    public async getLastBlock(): Promise<any> {
        await this.initWeb3();
        return await this.web3.eth.getBlockNumber();
    }

    public async getOpponents(address, tokenId, lastBlock): Promise<any[]> {
        try {
            const results = [];
            await this.initWeb3();
            const contractKombat = new this.web3.eth.Contract(kombat.output.abi, KOMBATADDRESS);
            let events = await contractKombat.getPastEvents('attackResult', {
                fromBlock: lastBlock,
                toBlock: lastBlock + 4900
            });
            if (events.length > 0) {
                for (const evnt of events) {
                    console.log("evnt", evnt);
                    let attackResult = "";
                    let opponent;

                    const returnValues = evnt.returnValues;
                    if (returnValues && (returnValues.defenderContract === address && returnValues.defender === tokenId)) {
                        opponent = await this.getFighterSimplyInfo(returnValues.attackerContract, returnValues.attacker);
                        if (returnValues.AttackSuccess === true) {
                            attackResult = "Lost";
                        } else {
                            attackResult = "Win";
                        }
                        const date = new Date(Number(returnValues.timestamp) * 1000);
                        const prize = (returnValues.prize / (10 ** 18)).toFixed(7);
                        const timeTxt = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
                        results.push({ ...opponent, type: "Defend", result: attackResult, blockNumber: evnt.blockNumber, prize, timestamp: returnValues.timestamp, timeTxt, tx: evnt.transactionHash });

                    } else if (returnValues && (returnValues.attackerContract === address && returnValues.attacker === tokenId)) {
                        opponent = await this.getFighterSimplyInfo(returnValues.defenderContract, returnValues.defender);
                        if (returnValues.AttackSuccess === true) {
                            attackResult = "Win";
                        } else {
                            attackResult = "Lost";
                        }
                        const date = new Date(Number(returnValues.timestamp) * 1000);
                        const prize = (returnValues.prize / (10 ** 18)).toFixed(7);
                        const timeTxt = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
                        results.push({ ...opponent, type: "Attack", result: attackResult, blockNumber: evnt.blockNumber, prize, timestamp: returnValues.timestamp, timeTxt, tx: evnt.transactionHash });
                    }
                }
            }
            return results;
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
            return [];
        }
    }

    public async getFighterBasicInfo(address, tokenId): Promise<any> {
        try {
            await this.initWeb3();
            let teamContent;

            // get fighter
            const contractFighter = new this.web3.eth.Contract(fighter.output.abi, address);
            const metadata = await contractFighter.methods.tokenURI(tokenId).call();
            const imageUploaded = await contractFighter.methods.tokenToImageUpdated(tokenId).call();
            const upgradable = await contractFighter.methods.upgradable(tokenId).call();
            const base64 = metadata.split(",")[1];
            let json = JSON.parse(Buffer.from(base64, 'base64').toString('ascii').replace("\"attributes\":\"", "\"attributes\":").replace("]\", \"image", "], \"image"));
            if (json?.attributes) {
                json.attributes = json.attributes.map((attr) => {
                    if (attr.trait_type === "Winnings") {
                        attr.value = (Number(attr.value) / (10 ** 18)).toFixed(7) + " BNB";
                    }
                    attr.displayValue = attr.value;
                    if (attr.trait_type === "Critical Chance") {
                        attr.displayValue = (attr.value * 10) + "% / 60%";
                    }
                    if (attr.trait_type === "Max Armor") {
                        attr.displayValue = attr.value + " / 25";
                    }
                    if (attr.trait_type === "Armor") {
                        attr.displayValue = attr.value + " / 25";
                    }
                    if (attr.trait_type === "Toughness") {
                        attr.displayValue = attr.value + " / 999";
                    }
                    if (attr.trait_type === "Fighter DNA") {
                        attr.displayValue = undefined;
                    }
                    return attr;
                });
            }
            const ownerOf = await contractFighter.methods.ownerOf(tokenId).call();
            teamContent = { address, token: tokenId, ownerOf, imageUploaded, metadata: json, upgradable };

            this.dataStream.next({ type: "fighter", fighter: teamContent });
            console.log("data", tokenId);
            return teamContent;
        } catch (ex) {
            this.notifierService.pop("error", "We can't check Kombat contract, try again later", "Contract connect");
            // not connected
            console.log(ex);
        }
        return {};
    }

}
