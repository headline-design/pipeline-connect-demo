import React from 'react'
import styles from './styles.module.css'
import MyAlgo from '@randlabs/myalgo-connect'
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import algosdk from "algosdk";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";

export class Pipeline {

    static init() {
        this.pipeConnector = "myAlgoWallet";
        this.main = true;
        this.address = "";
        this.txID = "";
        this.myBalance = 0;
        this.connector = new WalletConnect({
            bridge: "https://bridge.walletconnect.org", // Required
            qrcodeModal: QRCodeModal,
        });
        return new MyAlgo();
    }

    static async balance(address) {

        let indexerURL = 'https://'

        if (this.main == true) {
            indexerURL = indexerURL + 'algoexplorerapi.io/idx2/v2/accounts/'
        }
        else {
            indexerURL = indexerURL + "testnet.algoexplorerapi.io/idx2/v2/accounts/"
        }

        let url2 = indexerURL + address
        try {
            let data = await fetch(url2)
            let data2 = await data.json()
            let data3 = JSON.stringify(data2.account.amount / 1000000) + ' Algos'
            this.myBalance = data3;
            return data3;
        } catch (error) {
            console.log(error);
            return 0;
        }
    }

    static async connect(wallet) {
        if (this.pipeConnector === "myAlgoWallet") {
            try {
                const accounts = await wallet.connect()
                let item1 = accounts[0]
                item1 = item1['address']
                this.address = item1;
                return item1;
            } catch (err) {
                console.error(err)
            }
        }

        else {
            if (!this.connector.connected) {
                // create new session
                this.connector.on("connect", (error, payload) => {
                    if (error) {
                        throw error;
                    }
                    this.address = payload.params[0].accounts[0];
                }
                );

                this.connector.on("session_update", (error, payload) => {
                    alert(error + payload)
                    if (error) {
                        throw error;
                    }
                    // Get updated accounts 

                });

                this.connector.createSession();
               
            }
            else {
                this.connector.killSession();
            }
        }
    }

    static async walletConnectSign(mytxnb) {

        const suggestedParams = {
            flatFee: true,
            fee: 1000,
            firstRound: mytxnb.firstRound,
            lastRound: mytxnb.lastRound,
            genesisID: mytxnb.genesisID,
            genesisHash: mytxnb.genesisHash,
          }
          console.log("my transaction")
          console.log(mytxnb)

        const mytxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            from: this.address,
            to: mytxnb.to,
            amount: mytxnb.amount,
            note: mytxnb.note,
            suggestedParams
          });

        let txns = [];
        txns[0] = mytxn;
        // Sign transaction
        // txns is an array of algosdk.Transaction
        const txnsToSign = txns.map(txnb => {
            const encodedTxn = Buffer.from(algosdk.encodeUnsignedTransaction(txnb)).toString("base64");

            return {
                txn: encodedTxn,
                message: 'Description of transaction being signed',
                // Note: if the transaction does not need to be signed (because it's part of an atomic group
                // that will be signed by another party), specify an empty singers array like so:
                // signers: [],
            };
        });

        const requestParams = [txnsToSign];

        var request = formatJsonRpcRequest("algo_signTxn", requestParams);

        request.id = 1630701955126956;

        console.log(request);

        try {
            const result = await this.connector.sendCustomRequest(request);
            const signedPartialTxn = result[0]
                const rawSignedTxn = Buffer.from(signedPartialTxn, "base64");
                return new Uint8Array(rawSignedTxn);
        }
        catch (error) { console.log(error) }
    }

    static async send(address, amt, myNote, _sendingAddress, wallet, index = 0) {

        let paramServer = 'https://'
        let transServer = 'https://'

        if (this.main == true) {
            paramServer = paramServer + 'algoexplorerapi.io/v2/transactions/params/'
            transServer = transServer + 'algoexplorerapi.io/v2/transactions/'
        }
        else {
            paramServer = paramServer + "testnet.algoexplorerapi.io/v2/transactions/params/"
            transServer = transServer + "testnet.algoexplorerapi.io/v2/transactions/"
        }

        const algodToken = '0'

        var buf = new Array(myNote.length)
        var encodedNote = new Uint8Array(buf)
        for (var i = 0, strLen = myNote.length; i < strLen; i++) {
            encodedNote[i] = myNote.charCodeAt(i)
        }

        console.log('My encoded note: ' + encodedNote)

        try {
            const params = await (await fetch(paramServer)).json()

            let txn = {
                from: this.address,
                to: address,
                amount: parseInt(amt),
                note: encodedNote,
                genesisID: 'mainnet-v1.0',
                genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
                type: 'pay',
                flatFee: true,
                fee: 1000,
                firstRound: params['last-round'],
                lastRound: params['last-round'] + 1000,
            }

            if (index !== 0) {
                txn.type = 'axfer'
                txn.assetIndex = parseInt(index)
            }

            if (this.main == false) {
                txn.genesisID = 'testnet-v1.0'
                txn.genesisHash = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
            }

            let signedTxn = {};

            if (this.pipeConnector === "myAlgoWallet") {
                signedTxn = await wallet.signTransaction(txn)
                signedTxn = signedTxn.blob;
            }
            else {
                signedTxn = await this.walletConnectSign(txn)
            }

            console.log(signedTxn)

            let transactionID = await fetch(transServer, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-binary',
                },
                body: signedTxn
            })
                .then(response => response.json())
                .then(data => {
                    return data.txId
                })
                .catch(error => {
                    console.error('Error:', error)
                })

            this.txID = transactionID
            return transactionID
        } catch (err) {
            console.error(err)
        }
    }
}

export const AlgoSendButton = (props) => {

    return (
        <div>
            <button
                className={styles.AlgoSendButton}
                onClick={() => {
                    Pipeline.send(
                        props.recipient,
                        parseInt(props.amount || 1),
                        props.note || "",
                        Pipeline.myAddress,
                        props.wallet,
                        props.index || 0
                    ).then(data => {
                        if (typeof data !== 'undefined') {
                            if (props.returnTo !== undefined) {
                                const object = {}
                                object[props.returnTo] = data
                                props.context.setState(object)
                            }
                            if (typeof props.onChange === "function") {
                                props.onChange(data)
                            }
                        }
                    })
                }}
            >
                Send
            </button>
        </div>
    )
}

export const AlgoButton = (props) => {

    return (
        <button
            className={styles.AlgoButton}
            onClick={() => {
                Pipeline.connect(props.wallet).then(accounts => {

                    if (props.returnTo !== undefined) {
                        const data = {};
                        data[props.returnTo] = accounts;
                        props.context.setState(data);
                    }
                    if (typeof props.onChange === "function") {
                        props.onChange(accounts)
                    }
                })
            }}
        >
            Connect
        </button>
    )
}